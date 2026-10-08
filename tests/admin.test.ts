import { describe, expect, it } from 'vitest';
import { ADMIN, get, makeApp, post, sessionCookie, OWNER } from './helpers';

const form = (fields: { title?: string; name?: string; content?: BlobPart }) => {
  const data = new FormData();
  if (fields.title !== undefined) data.set('title', fields.title);
  if (fields.name !== undefined) data.set('file', new File([fields.content ?? '<p>isi</p>'], fields.name, { type: 'text/html' }));
  return data;
};

describe('unggah', () => {
  it('admin mengunggah laporan lalu laporan muncul di daftar dan dapat dibuka owner', async () => {
    const { app, store } = makeApp();
    const admin = await sessionCookie(app, ADMIN);
    const res = await post(app, '/admin/reports', admin, form({ title: '  Laporan Oktober  ', name: 'oktober.html', content: '<h1>Okt</h1>' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin?added=1');

    const [meta] = await store.list();
    expect(meta.title).toBe('Laporan Oktober');
    expect((await store.get(meta.id))?.html).toBe('<h1>Okt</h1>');

    const owner = await sessionCookie(app, OWNER);
    expect(await (await get(app, '/', owner)).text()).toContain('Laporan Oktober');
    expect(await (await get(app, `/raw/${meta.id}`, owner)).text()).toBe('<h1>Okt</h1>');
    expect(await (await get(app, '/admin?added=1', admin)).text()).toContain('Laporan ditambahkan');
  });

  it.each([
    ['judul kosong', form({ title: '   ', name: 'a.html' }), 400, 'Judul'],
    ['judul 121 karakter', form({ title: 'x'.repeat(121), name: 'a.html' }), 400, 'Judul'],
    ['tanpa berkas', form({ title: 'A' }), 400, 'Pilih berkas'],
    ['berkas kosong', form({ title: 'A', name: 'a.html', content: '' }), 400, 'Pilih berkas'],
    ['ekstensi salah', form({ title: 'A', name: 'a.pdf' }), 400, '.html'],
    ['bukan UTF-8', form({ title: 'A', name: 'a.html', content: new Uint8Array([0xff, 0xfe, 0xfa]) }), 400, 'UTF-8'],
    ['5 MB', form({ title: 'A', name: 'a.html', content: 'x'.repeat(5 * 1024 * 1024) }), 413, '4 MB'],
  ])('menolak %s dan tidak menyimpan apa pun', async (_label, body, status, message) => {
    const { app, store } = makeApp();
    const res = await post(app, '/admin/reports', await sessionCookie(app, ADMIN), body);
    expect(res.status).toBe(status);
    expect(await res.text()).toContain(message);
    expect(await store.list()).toEqual([]);
  });

  it('menerima ekstensi .HTM dan judul tepat 120 karakter', async () => {
    const { app, store } = makeApp();
    const res = await post(app, '/admin/reports', await sessionCookie(app, ADMIN), form({ title: 'x'.repeat(120), name: 'LAPORAN.HTM' }));
    expect(res.status).toBe(303);
    expect(await store.list()).toHaveLength(1);
  });

  it('judul berbahaya tersimpan apa adanya tetapi ditampilkan ter-escape di daftar dan admin', async () => {
    const { app } = makeApp();
    const admin = await sessionCookie(app, ADMIN);
    await post(app, '/admin/reports', admin, form({ title: '<img src=x onerror=alert(1)>', name: 'a.html' }));
    for (const path of ['/', '/admin']) {
      const body = await (await get(app, path, admin)).text();
      expect(body).not.toContain('<img src=x');
      expect(body).toContain('&lt;img src=x onerror=alert(1)&gt;');
    }
  });
});

describe('hapus', () => {
  it('admin menghapus laporan', async () => {
    const { app, store } = makeApp();
    const meta = await store.add({ title: 'Hapus saya', html: '<p>x</p>' });
    const res = await post(app, `/admin/reports/${meta.id}/delete`, await sessionCookie(app, ADMIN));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin?removed=1');
    expect(await store.list()).toEqual([]);
  });

  it('ID tidak ada atau tidak valid menghasilkan 404 tanpa mengubah apa pun', async () => {
    const { app, store } = makeApp();
    await store.add({ title: 'Tetap', html: '<p>x</p>' });
    const admin = await sessionCookie(app, ADMIN);
    for (const id of ['tidak-ada-1', '..%2Findex', 'a'.repeat(40)]) {
      expect((await post(app, `/admin/reports/${id}/delete`, admin)).status).toBe(404);
    }
    expect(await store.list()).toHaveLength(1);
  });
});

describe('otorisasi dan CSRF', () => {
  it('owner tidak bisa mengunggah atau menghapus', async () => {
    const { app, store } = makeApp();
    const meta = await store.add({ title: 'Milik admin', html: '<p>x</p>' });
    const owner = await sessionCookie(app, OWNER);
    expect((await post(app, '/admin/reports', owner, form({ title: 'A', name: 'a.html' }))).status).toBe(403);
    expect((await post(app, `/admin/reports/${meta.id}/delete`, owner)).status).toBe(403);
    expect(await store.list()).toHaveLength(1);
  });

  it('tanpa sesi: POST ditolak 401', async () => {
    const { app } = makeApp();
    const res = await app.request('/admin/reports', { method: 'POST', body: form({ title: 'A', name: 'a.html' }), headers: { origin: 'http://localhost' } });
    expect(res.status).toBe(401);
  });

  it.each([
    ['origin lain', { origin: 'https://situs-jahat.example' }],
    ['tanpa origin', { origin: '' }],
  ])('POST lintas situs dengan cookie admin sah ditolak (%s) dan tidak mengubah apa pun', async (_label, headers) => {
    const { app, store } = makeApp();
    const meta = await store.add({ title: 'Aman', html: '<p>x</p>' });
    const admin = await sessionCookie(app, ADMIN);

    const upload = await post(app, '/admin/reports', admin, form({ title: 'Jahat', name: 'a.html' }), headers);
    const remove = await post(app, `/admin/reports/${meta.id}/delete`, admin, undefined, headers);
    expect([upload.status, remove.status]).toEqual([403, 403]);
    expect((await store.list()).map((item) => item.title)).toEqual(['Aman']);
  });
});
