// HTTP app factory; keep this file separate from Vercel's src/index.ts entrypoint.
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { LOGO_PNG_BASE64 } from './assets/logo.js';
import type { Config } from './config.js';
import { safeEqual } from './passwords.js';
import type { LoginLimiter } from './rate-limit.js';
import { createSession, readSession, SESSION_TTL_SECONDS, type Role } from './session.js';
import { parseDana, parseSiklus } from './siklus/validasi.js';
import { BatasDanaError, isValidDanaId } from './store/dana-store.js';
import { parseNo, SiklusSudahAdaError } from './store/siklus-store.js';
import type { DanaStore, SiklusStore } from './store/types.js';
import { adminPage } from './views/admin.js';
import { detailPage } from './views/detail.js';
import { loginPage, messagePage } from './views/layout.js';
import { ringkasanPage } from './views/ringkasan.js';

export interface Deps {
  config: Config;
  siklus: SiklusStore;
  dana: DanaStore;
  limiter: LoginLimiter;
  now?: () => number;
}

type AppEnv = { Variables: { role: Role | null } };
type AppContext = Context<AppEnv>;

const COOKIE = 'overview_session';
const APP_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const LOGO_PNG = Uint8Array.from(atob(LOGO_PNG_BASE64), (char) => char.charCodeAt(0));

const PESAN: Record<string, string> = {
  added: 'Siklus ditambahkan.',
  replaced: 'Siklus diganti.',
  removed: 'Siklus dihapus.',
  dana: 'Dana ditambahkan.',
  danahapus: 'Dana dihapus.',
};

const clientKey = (headers: Headers) =>
  headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
  headers.get('x-forwarded-for')?.split(',')[0].trim() ||
  'unknown';

export function createApp({ config, siklus, dana, limiter, now = Date.now }: Deps) {
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

  // Logo perusahaan: statis dan tidak rahasia, jadi boleh dilihat di halaman login dan di-cache.
  app.get('/aset/logo-putih.png', (c) => {
    c.header('Cache-Control', 'public, max-age=86400');
    return c.body(LOGO_PNG, 200, { 'Content-Type': 'image/png' });
  });

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
    const [isAdmin, isOwner] = await Promise.all([
      safeEqual(password, config.adminPassword),
      safeEqual(password, config.ownerPassword),
    ]);
    const role: Role | null = isAdmin ? 'admin' : isOwner ? 'owner' : null;

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

  app.get('/', async (c) =>
    c.html(ringkasanPage({ daftar: await siklus.list(), dana: await dana.list(), peran: c.get('role') as Role })),
  );

  const notFound = (c: AppContext) => c.html(messagePage('Tidak ditemukan', 'Siklus tidak ada.'), 404);

  app.get('/siklus/:no', async (c) => {
    const no = parseNo(c.req.param('no'));
    if (no === null) return notFound(c);
    const daftar = await siklus.list();
    const ditemukan = daftar.find((s) => s.no === no);
    return ditemukan ? c.html(detailPage({ daftar, siklus: ditemukan, peran: c.get('role') as Role })) : notFound(c);
  });

  const renderAdmin = async (
    c: AppContext,
    status: 200 | 400 | 413,
    tambahan: { pesan?: string; galatSiklus?: string[]; galatDana?: string[] } = {},
  ) => c.html(adminPage({ daftar: await siklus.list(), dana: await dana.list(), ...tambahan }), status);

  app.get('/admin', (c) => {
    const kunci = Object.keys(PESAN).find((k) => c.req.query(k));
    return renderAdmin(c, 200, { pesan: kunci ? PESAN[kunci] : undefined });
  });

  const MAX_UPLOAD_BYTES = 512 * 1024;

  app.post('/admin/siklus', async (c) => {
    const tolak = (status: 400 | 413, galat: string[]) => renderAdmin(c, status, { galatSiklus: galat });

    const body = await c.req.parseBody();
    const file = body.file;
    const timpa = body.timpa === '1';

    if (!(file instanceof File) || file.size === 0) return tolak(400, ['Pilih berkas JSON yang tidak kosong.']);
    if (!/\.json$/i.test(file.name)) return tolak(400, ['Berkas harus berakhiran .json.']);
    if (file.size > MAX_UPLOAD_BYTES) return tolak(413, ['Ukuran berkas maksimal 512 KB.']);

    let teks: string;
    try {
      // TextDecoder membuang BOM UTF-8 di awal berkas (umum dari Notepad dan Excel).
      teks = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    } catch {
      return tolak(400, ['Berkas harus berupa teks UTF-8.']);
    }

    const hasil = parseSiklus(teks);
    if (!hasil.ok) return tolak(400, hasil.galat);

    try {
      const status = await siklus.put(hasil.siklus, { timpa });
      return c.redirect(status === 'diganti' ? '/admin?replaced=1' : '/admin?added=1', 303);
    } catch (error) {
      if (error instanceof SiklusSudahAdaError) {
        return tolak(400, [`Siklus ${error.no} sudah ada. Centang "Timpa jika nomor sudah ada" untuk menggantinya.`]);
      }
      throw error;
    }
  });

  app.post('/admin/siklus/:no/hapus', async (c) => {
    const no = parseNo(c.req.param('no'));
    const dihapus = no !== null && (await siklus.remove(no));
    return dihapus ? c.redirect('/admin?removed=1', 303) : notFound(c);
  });

  app.post('/admin/dana', async (c) => {
    const body = await c.req.parseBody();
    const hasil = parseDana({ tanggal: body.tanggal, jumlah: body.jumlah, keterangan: body.keterangan });
    if (!hasil.ok) return renderAdmin(c, 400, { galatDana: hasil.galat });
    try {
      await dana.add(hasil.dana);
    } catch (error) {
      if (error instanceof BatasDanaError) return renderAdmin(c, 400, { galatDana: [error.message] });
      throw error;
    }
    return c.redirect('/admin?dana=1', 303);
  });

  app.post('/admin/dana/:id/hapus', async (c) => {
    const id = c.req.param('id');
    const dihapus = isValidDanaId(id) && (await dana.remove(id));
    return dihapus ? c.redirect('/admin?danahapus=1', 303) : notFound(c);
  });

  app.notFound((c) => c.html(messagePage('Tidak ditemukan', 'Halaman tidak ada.'), 404));
  app.onError((error, c) => {
    console.error(error);
    return c.html(messagePage('Terjadi kesalahan', 'Coba lagi sebentar lagi.'), 500);
  });

  return app;
}
