import { describe, expect, it } from 'vitest';
import { createSession } from '../src/session';
import { ADMIN, get, login, makeApp, ORIGIN, post, SECRET, sessionCookie, OWNER } from './helpers';

const hostile = '<script>fetch("/admin")</script><p>isi laporan</p>';

describe('login', () => {
  it('menampilkan form dan memberi cookie dengan atribut yang benar', async () => {
    const { app } = makeApp();
    expect((await get(app, '/login')).status).toBe(200);

    const res = await login(app, OWNER);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/');
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^__Host-overview_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=43200/);
  });

  it('menolak sandi salah dengan pesan generik dan tanpa cookie', async () => {
    const { app } = makeApp();
    const res = await login(app, 'salah');
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await res.text()).toContain('Sandi salah');
  });

  it('memblokir setelah 5 kegagalan dari IP yang sama, termasuk untuk sandi benar', async () => {
    const { app } = makeApp();
    const ip = { 'x-forwarded-for': '203.0.113.9' };
    for (let i = 0; i < 5; i += 1) expect((await login(app, 'salah', ip)).status).toBe(401);
    const blocked = await login(app, ADMIN, ip);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect((await login(app, ADMIN, { 'x-forwarded-for': '203.0.113.10' })).status).toBe(303);
  });

  it('logout menghapus sesi', async () => {
    const { app } = makeApp();
    const cookie = await sessionCookie(app, OWNER);
    const res = await post(app, '/logout', cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0|Expires=/i);
  });
});

describe('akses tanpa sesi', () => {
  it.each(['/', '/r/laporan-0001', '/raw/laporan-0001', '/admin'])('GET %s dialihkan ke /login', async (path) => {
    const { app } = makeApp();
    const res = await get(app, path);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/login');
  });

  it('robots.txt publik dan melarang semua', async () => {
    const { app } = makeApp();
    const res = await get(app, '/robots.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Disallow: /');
  });

  it('token yang diubah dianggap tanpa sesi', async () => {
    const { app } = makeApp();
    const owner = await sessionCookie(app, OWNER);
    const [, signature] = owner.split('=')[1].split('.');
    const payload = btoa(JSON.stringify({ r: 'admin', exp: 9_999_999_999 })).replace(/=+$/, '');
    const forged = `__Host-overview_session=${payload}.${signature}`;
    expect((await get(app, '/admin', forged)).status).toBe(303);
  });

  it('sesi kedaluwarsa dan sesi bertanda tangan rahasia lain ditolak', async () => {
    let t = 1_700_000_000_000;
    const { app } = makeApp({ now: () => t });
    const cookie = await sessionCookie(app, OWNER);
    expect((await get(app, '/', cookie)).status).toBe(200);
    t += 13 * 3600 * 1000;
    expect((await get(app, '/', cookie)).status).toBe(303);

    const foreign = `__Host-overview_session=${await createSession('admin', 'x'.repeat(32), t)}`;
    expect((await get(app, '/', foreign)).status).toBe(303);
  });
});

describe('daftar, owner, dan raw', () => {
  it('daftar menampilkan judul ter-escape dan tidak menampilkan tombol admin untuk owner', async () => {
    const { app, store } = makeApp();
    await store.add({ title: '<script>alert(1)</script>', html: '<p>x</p>' });
    const body = await (await get(app, '/', await sessionCookie(app, OWNER))).text();
    expect(body).not.toContain('<script>alert(1)</script>');
    expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body).not.toContain('/admin');
  });

  it('admin melihat tautan ke halaman admin', async () => {
    const { app } = makeApp();
    expect(await (await get(app, '/', await sessionCookie(app, ADMIN))).text()).toContain('href="/admin"');
  });

  it('owner memuat iframe ber-sandbox tanpa allow-same-origin', async () => {
    const { app, store } = makeApp();
    const meta = await store.add({ title: 'Laporan', html: hostile });
    const res = await get(app, `/r/${meta.id}`, await sessionCookie(app, OWNER));
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toMatch(new RegExp(`<iframe[^>]*src="/raw/${meta.id}"`));
    expect(body).toMatch(/<iframe[^>]*sandbox="allow-scripts"/);
    expect(body).not.toMatch(/allow-same-origin/);
    expect(body).not.toContain('fetch("/admin")');
  });

  it('raw mengirim HTML apa adanya dengan CSP sandbox dan tanpa cache', async () => {
    const { app, store } = makeApp();
    const meta = await store.add({ title: 'Laporan', html: hostile });
    const res = await get(app, `/raw/${meta.id}`, await sessionCookie(app, OWNER));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(hostile);
    const csp = res.headers.get('content-security-policy')!;
    expect(csp).toMatch(/^sandbox allow-scripts;/);
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain('allow-same-origin');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
  });

  it.each(['/r/', '/raw/'])('%s dengan ID tidak valid atau tidak ada menghasilkan 404', async (prefix) => {
    const { app } = makeApp();
    const cookie = await sessionCookie(app, OWNER);
    for (const id of ['tidak-ada-1', '..%2Findex', '%2e%2e%2findex.json', 'a'.repeat(40)]) {
      expect((await get(app, `${prefix}${id}`, cookie)).status).toBe(404);
    }
  });

  it('semua respons membawa header keamanan, halaman aplikasi memakai CSP ketat', async () => {
    const { app } = makeApp();
    const cookie = await sessionCookie(app, OWNER);
    for (const res of [await get(app, '/login'), await get(app, '/', cookie), await get(app, '/tidak-ada', cookie)]) {
      expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('strict-transport-security')).toMatch(/max-age=/);
    }
    const csp = (await get(app, '/', cookie)).headers.get('content-security-policy')!;
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'self'");
  });

  it('POST /login dari origin lain ditolak sebelum memeriksa sandi', async () => {
    const { app } = makeApp();
    const res = await app.request('/login', {
      method: 'POST',
      headers: { origin: 'https://situs-lain.example', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: ADMIN }).toString(),
    });
    expect(res.status).toBe(403);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('owner mendapat 403 di rute admin', async () => {
    const { app } = makeApp();
    const cookie = await sessionCookie(app, OWNER);
    expect((await get(app, '/admin', cookie)).status).toBe(403);
    expect(ORIGIN).toBe('http://localhost');
    expect(SECRET).toHaveLength(32);
  });
});
