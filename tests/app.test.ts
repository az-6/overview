// tests/app.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSession } from '../src/session';
import type { Siklus } from '../src/siklus/types';
import { ADMIN, get, login, makeApp, ORIGIN, post, SECRET, sessionCookie, OWNER } from './helpers';
import { siklusContoh } from './fixtures';

const contoh = JSON.parse(readFileSync('samples/siklus-contoh.json', 'utf8')) as Siklus;
const jahat = '<script>alert(1)</script>';

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

  it('POST /login menerima browser tanpa Origin maupun Origin yang berbeda', async () => {
    const { app } = makeApp();
    const headers: Record<string, string>[] = [
      {},
      { origin: 'https://situs-lain.example' },
      { origin: 'null' },
    ];
    for (const extra of headers) {
      const res = await app.request('/login', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...extra },
        body: new URLSearchParams({ password: OWNER }).toString(),
      });
      expect(res.status).toBe(303);
      expect(res.headers.get('set-cookie')).toMatch(/^__Host-overview_session=/);
    }
  });
});

describe('akses tanpa sesi', () => {
  it.each(['/', '/siklus/1', '/admin'])('GET %s dialihkan ke /login', async (path) => {
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

  it('logo publik, bertipe PNG, boleh di-cache, dan bukan halaman terlindungi', async () => {
    const { app } = makeApp();
    const res = await get(app, '/aset/logo-putih.png');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toMatch(/public/);
    expect(res.headers.get('set-cookie')).toBeNull();
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
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

describe('Ringkasan', () => {
  it('kosong: owner tidak melihat tombol atau tautan admin, admin melihat Tambah siklus', async () => {
    const { app } = makeApp();
    const owner = await (await get(app, '/', await sessionCookie(app, OWNER))).text();
    expect(owner).toContain('Belum ada siklus produksi');
    expect(owner).not.toContain('Tambah siklus');
    expect(owner).not.toContain('/admin');
    const admin = await (await get(app, '/', await sessionCookie(app, ADMIN))).text();
    expect(admin).toContain('Tambah siklus');
    expect(admin).toContain('href="/admin"');
  });

  it('berisi siklus: kedua peran melihat angka dan tautan rincian yang sama', async () => {
    const { app, siklus } = makeApp();
    await siklus.put(contoh, { timpa: false });
    for (const sandi of [OWNER, ADMIN]) {
      const body = await (await get(app, '/', await sessionCookie(app, sandi))).text();
      expect(body).toContain('laba Rp 4.503.468');
      expect(body).toContain('href="/siklus/1"');
    }
  });

  it('bagian Dana investor hanya muncul bila ada dana, sama untuk kedua peran', async () => {
    const { app, siklus, dana } = makeApp();
    await siklus.put(contoh, { timpa: false });
    const owner = await sessionCookie(app, OWNER);
    const admin = await sessionCookie(app, ADMIN);
    expect(await (await get(app, '/', owner)).text()).not.toContain('Dana investor');
    await dana.add({ tanggal: '2026-10-06', jumlah: 1367000000, keterangan: 'Kas produksi' });
    for (const cookie of [owner, admin]) {
      const body = await (await get(app, '/', cookie)).text();
      expect(body).toContain('Sisa dana Rp 1.371.503.468 dari Rp 1.367.000.000 yang diterima');
    }
  });

  it('data bermusuhan dari penyimpanan tampil ter-escape di Ringkasan, rincian, dan admin', async () => {
    const { app, siklus, dana } = makeApp();
    await siklus.put(
      siklusContoh({ pembeli: jahat, ekor: [{ tag: jahat, kg: 44, loinKg: 27.75, grade: jahat }], langkah: [{ judul: jahat, isi: jahat, status: 'selesai' }] }),
      { timpa: false },
    );
    await dana.add({ tanggal: '2026-10-06', jumlah: 1000, keterangan: jahat });
    const admin = await sessionCookie(app, ADMIN);
    for (const path of ['/', '/siklus/1', '/admin']) {
      const body = await (await get(app, path, admin)).text();
      expect(body, path).not.toMatch(/<script/i);
      expect(body, path).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    }
  });

  it('galat penyimpanan menghasilkan 500 generik tanpa isi galat', async () => {
    const { app, backend } = makeApp();
    await backend.write('data/siklus.json', '{bukan json');
    const res = await get(app, '/', await sessionCookie(app, OWNER));
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain('Terjadi kesalahan');
    expect(body).not.toMatch(/JSON|Unexpected/);
  });
});

describe('rincian siklus', () => {
  it('menampilkan siklus yang ada untuk owner', async () => {
    const { app, siklus } = makeApp();
    await siklus.put(contoh, { timpa: false });
    const res = await get(app, '/siklus/1', await sessionCookie(app, OWNER));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('Siklus 1: yield 62,6 %');
    expect(body).not.toContain('/admin');
  });

  it.each(['2', '0', '01', '10000', 'abc', '1.5', '-1', '..%2Findex', '%2e%2e%2fdata%2fsiklus.json'])(
    '/siklus/%s menghasilkan 404',
    async (no) => {
      const { app, siklus } = makeApp();
      await siklus.put(contoh, { timpa: false });
      expect((await get(app, `/siklus/${no}`, await sessionCookie(app, OWNER))).status).toBe(404);
    },
  );

  it.each(['/r/laporan-0001', '/raw/laporan-0001', '/admin/reports'])('rute laporan lama %s sudah tidak ada', async (path) => {
    const { app } = makeApp();
    expect((await get(app, path, await sessionCookie(app, ADMIN))).status).toBe(404);
  });
});

describe('header keamanan', () => {
  it('semua respons membawa header keamanan dan CSP halaman yang ketat', async () => {
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
    expect(csp).toBe("default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  });
});

describe('akses admin', () => {
  it('owner mendapat 403 di /admin, admin mendapat 200', async () => {
    const { app } = makeApp();
    expect((await get(app, '/admin', await sessionCookie(app, OWNER))).status).toBe(403);
    const res = await get(app, '/admin', await sessionCookie(app, ADMIN));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('action="/admin/siklus"');
  });

  it.each([
    ['added=1', 'Siklus ditambahkan.'],
    ['replaced=1', 'Siklus diganti.'],
    ['removed=1', 'Siklus dihapus.'],
    ['dana=1', 'Dana ditambahkan.'],
    ['danahapus=1', 'Dana dihapus.'],
  ])('/admin?%s menampilkan pesan', async (query, pesan) => {
    const { app } = makeApp();
    const body = await (await get(app, `/admin?${query}`, await sessionCookie(app, ADMIN))).text();
    expect(body).toContain(pesan);
  });

  it('konstanta pembantu tes konsisten', () => {
    expect(ORIGIN).toBe('http://localhost');
    expect(SECRET).toHaveLength(32);
  });
});
