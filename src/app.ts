import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Config } from './config';
import { adminPage, listPage, loginPage, messagePage, viewerPage } from './pages';
import { safeEqual } from './passwords';
import type { LoginLimiter } from './rate-limit';
import { createSession, readSession, SESSION_TTL_SECONDS, type Role } from './session';
import { isValidReportId } from './store/report-store';
import type { ReportStore } from './store/types';

export interface Deps {
  config: Config;
  store: ReportStore;
  limiter: LoginLimiter;
  now?: () => number;
}

type AppEnv = { Variables: { role: Role | null } };
type AppContext = Context<AppEnv>;

const COOKIE = 'overview_session';
const APP_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-src 'self'; base-uri 'none'; frame-ancestors 'none'";
const RAW_CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'";

const clientKey = (headers: Headers) =>
  headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
  headers.get('x-forwarded-for')?.split(',')[0].trim() ||
  'unknown';

export function createApp({ config, store, limiter, now = Date.now }: Deps) {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Strict-Transport-Security', 'max-age=31536000');
    c.header('Content-Security-Policy', APP_CSP);
    await next();
  });

  // Semua metode selain GET/HEAD harus berasal dari origin yang sama; header hilang berarti ditolak.
  app.use('*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.header('origin') !== new URL(c.req.url).origin) {
      return c.html(messagePage('Ditolak', 'Permintaan tidak berasal dari situs ini.'), 403);
    }
    await next();
  });

  app.use('*', async (c, next) => {
    const token = getCookie(c, COOKIE, 'host');
    c.set('role', token ? await readSession(token, config.sessionSecret, now()) : null);
    await next();
  });

  app.get('/robots.txt', (c) => c.text('User-agent: *\nDisallow: /\n'));

  app.get('/login', (c) => (c.get('role') ? c.redirect('/', 303) : c.html(loginPage())));

  app.post('/login', async (c) => {
    const key = clientKey(c.req.raw.headers);
    if (limiter.isBlocked(key)) {
      const wait = limiter.retryAfterSeconds(key);
      c.header('Retry-After', String(wait));
      return c.html(messagePage('Terlalu banyak percobaan', `Coba lagi dalam ${Math.ceil(wait / 60)} menit.`), 429);
    }

    const body = await c.req.parseBody();
    const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
    // Kedua perbandingan selalu dijalankan agar waktu tidak membedakan peran.
    const [isAdmin, isViewer] = await Promise.all([
      safeEqual(password, config.adminPassword),
      safeEqual(password, config.viewerPassword),
    ]);
    const role: Role | null = isAdmin ? 'admin' : isViewer ? 'viewer' : null;

    if (!role) {
      limiter.recordFailure(key);
      return c.html(loginPage('Sandi salah.'), 401);
    }
    limiter.reset(key);
    setCookie(c, COOKIE, await createSession(role, config.sessionSecret, now()), {
      prefix: 'host',
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return c.redirect('/', 303);
  });

  // Semua rute di bawah ini membutuhkan sesi.
  app.use('*', async (c, next) => {
    if (c.get('role')) return next();
    if (c.req.method === 'GET' || c.req.method === 'HEAD') return c.redirect('/login', 303);
    return c.html(messagePage('Perlu login', 'Silakan login terlebih dahulu.'), 401);
  });

  const adminOnly = async (c: AppContext, next: () => Promise<void>) =>
    c.get('role') === 'admin'
      ? next()
      : c.html(messagePage('Akses ditolak', 'Halaman ini hanya untuk admin.'), 403);
  app.use('/admin', adminOnly);
  app.use('/admin/*', adminOnly);

  app.post('/logout', (c) => {
    deleteCookie(c, COOKIE, { prefix: 'host', path: '/', secure: true });
    return c.redirect('/login', 303);
  });

  app.get('/', async (c) => c.html(listPage({ reports: await store.list(), isAdmin: c.get('role') === 'admin' })));

  const notFound = (c: AppContext) => c.html(messagePage('Tidak ditemukan', 'Laporan tidak ada.'), 404);

  app.get('/r/:id', async (c) => {
    const id = c.req.param('id');
    const found = isValidReportId(id) ? await store.get(id) : null;
    return found ? c.html(viewerPage(found.meta)) : notFound(c);
  });

  app.get('/raw/:id', async (c) => {
    const id = c.req.param('id');
    const found = isValidReportId(id) ? await store.get(id) : null;
    if (!found) return notFound(c);
    c.header('Content-Security-Policy', RAW_CSP);
    return c.body(found.html, 200, { 'Content-Type': 'text/html; charset=utf-8' });
  });

  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
  const MAX_TITLE_LENGTH = 120;

  app.get('/admin', async (c) =>
    c.html(
      adminPage({
        reports: await store.list(),
        message: c.req.query('added') ? 'Laporan ditambahkan.' : c.req.query('removed') ? 'Laporan dihapus.' : undefined,
      }),
    ),
  );

  app.post('/admin/reports', async (c) => {
    const reject = async (status: 400 | 413, error: string) => c.html(adminPage({ reports: await store.list(), error }), status);

    const body = await c.req.parseBody();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const file = body.file;

    if (!title || title.length > MAX_TITLE_LENGTH) return reject(400, `Judul wajib diisi, maksimal ${MAX_TITLE_LENGTH} karakter.`);
    if (!(file instanceof File) || file.size === 0) return reject(400, 'Pilih berkas HTML yang tidak kosong.');
    if (!/\.html?$/i.test(file.name)) return reject(400, 'Berkas harus berakhiran .html atau .htm.');
    if (file.size > MAX_UPLOAD_BYTES) return reject(413, 'Ukuran berkas maksimal 4 MB.');

    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    } catch {
      return reject(400, 'Berkas harus berupa teks UTF-8.');
    }

    await store.add({ title, html: content });
    return c.redirect('/admin?added=1', 303);
  });

  app.post('/admin/reports/:id/delete', async (c) => {
    const id = c.req.param('id');
    const removed = isValidReportId(id) && (await store.remove(id));
    return removed ? c.redirect('/admin?removed=1', 303) : notFound(c);
  });

  app.notFound((c) => c.html(messagePage('Tidak ditemukan', 'Halaman tidak ada.'), 404));
  app.onError((error, c) => {
    console.error(error);
    return c.html(messagePage('Terjadi kesalahan', 'Coba lagi sebentar lagi.'), 500);
  });

  return app;
}
