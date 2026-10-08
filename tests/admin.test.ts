// tests/admin.test.ts
import { describe, expect, it } from 'vitest';
import { ADMIN, get, makeApp, post, sessionCookie, OWNER } from './helpers';
import { siklusContoh } from './fixtures';

const berkas = (isi: string | Uint8Array, nama = 'siklus.json', opsi: { timpa?: boolean } = {}) => {
  const data = new FormData();
  data.set('file', new File([isi as BlobPart], nama, { type: 'application/json' }));
  if (opsi.timpa) data.set('timpa', '1');
  return data;
};
const unggahan = (o: Parameters<typeof siklusContoh>[0] = {}, nama?: string, opsi?: { timpa?: boolean }) =>
  berkas(JSON.stringify(siklusContoh(o)), nama, opsi);
const formDana = (isian: Record<string, string>) => new URLSearchParams(isian);
const danaOk = { tanggal: '2026-10-06', jumlah: '1.367.000.000', keterangan: 'Kas produksi' };
const urlenc = { 'content-type': 'application/x-www-form-urlencoded' };
const jahat = '<script>alert(1)</script>';

describe('unggah siklus', () => {
  it('admin mengunggah siklus; owner langsung melihatnya', async () => {
    const { app, siklus } = makeApp();
    const admin = await sessionCookie(app, ADMIN);
    const res = await post(app, '/admin/siklus', admin, unggahan({ no: 4, pembeli: '  PT Baru  ' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin?added=1');
    expect((await siklus.get(4))?.pembeli).toBe('PT Baru');

    const owner = await sessionCookie(app, OWNER);
    expect(await (await get(app, '/', owner)).text()).toContain('href="/siklus/4"');
    expect((await get(app, '/siklus/4', owner)).status).toBe(200);
    expect(await (await get(app, '/admin?added=1', admin)).text()).toContain('Siklus ditambahkan.');
  });

  it('nomor kembar ditolak kecuali Timpa dicentang', async () => {
    const { app, siklus } = makeApp();
    const admin = await sessionCookie(app, ADMIN);
    await post(app, '/admin/siklus', admin, unggahan({ pembeli: 'Lama' }));

    const tolak = await post(app, '/admin/siklus', admin, unggahan({ pembeli: 'Baru' }));
    expect(tolak.status).toBe(400);
    const pesan = await tolak.text();
    expect(pesan).toContain('Siklus 1 sudah ada');
    expect(pesan).toContain('Timpa');
    expect((await siklus.get(1))?.pembeli).toBe('Lama');

    const timpa = await post(app, '/admin/siklus', admin, unggahan({ pembeli: 'Baru' }, 'siklus.json', { timpa: true }));
    expect(timpa.status).toBe(303);
    expect(timpa.headers.get('location')).toBe('/admin?replaced=1');
    expect((await siklus.get(1))?.pembeli).toBe('Baru');
    expect(await siklus.list()).toHaveLength(1);
  });

  it.each([
    ['tanpa berkas', () => new FormData(), 400, 'Pilih berkas'],
    ['berkas kosong', () => berkas(''), 400, 'Pilih berkas'],
    ['ekstensi salah', () => berkas(JSON.stringify(siklusContoh()), 'siklus.txt'), 400, '.json'],
    ['bukan UTF-8', () => berkas(new Uint8Array([0xff, 0xfe, 0xfa]), 'siklus.json'), 400, 'UTF-8'],
    ['bukan JSON', () => berkas('{rusak'), 400, 'bukan JSON'],
    ['larik', () => berkas('[]'), 400, 'satu objek'],
    ['null', () => berkas('null'), 400, 'satu objek'],
    ['nomor 0', () => unggahan({ no: 0 }), 400, 'nomor'],
    ['kg loin melebihi berat', () => unggahan({ ekor: [{ tag: '003', kg: 39, loinKg: 40, grade: 'C' }] }), 400, 'kg loin 40 lebih besar'],
    ['600 KB', () => berkas(JSON.stringify(siklusContoh({ pembeli: 'x'.repeat(600 * 1024) }))), 413, '512 KB'],
    ['5 MB', () => berkas('x'.repeat(5 * 1024 * 1024)), 413, '512 KB'],
  ])('menolak %s dan tidak menyimpan apa pun', async (_label, buat, status, pesan) => {
    const { app, siklus } = makeApp();
    const res = await post(app, '/admin/siklus', await sessionCookie(app, ADMIN), buat());
    expect(res.status).toBe(status);
    expect(await res.text()).toContain(pesan);
    expect(await siklus.list()).toEqual([]);
  });

  it('menerima ekstensi .JSON huruf besar dan BOM UTF-8 dari Notepad atau Excel', async () => {
    const { app, siklus } = makeApp();
    const admin = await sessionCookie(app, ADMIN);
    expect((await post(app, '/admin/siklus', admin, berkas(JSON.stringify(siklusContoh({ no: 1 })), 'SIKLUS.JSON'))).status).toBe(303);
    expect((await post(app, '/admin/siklus', admin, berkas('\uFEFF' + JSON.stringify(siklusContoh({ no: 2 }))))).status).toBe(303);
    expect((await siklus.list()).map((s) => s.no)).toEqual([1, 2]);
  });

  it('kunci __proto__ dan constructor dibuang, aplikasi tetap berjalan', async () => {
    const { app, siklus } = makeApp();
    const admin = await sessionCookie(app, ADMIN);
    const teks = JSON.stringify(siklusContoh()).replace('{', '{"__proto__":{"admin":true},"constructor":{"x":1},');
    expect((await post(app, '/admin/siklus', admin, berkas(teks))).status).toBe(303);
    expect(Object.keys((await siklus.get(1))!)).not.toContain('constructor');
    expect(({} as { admin?: boolean }).admin).toBeUndefined();
    expect((await get(app, '/', admin)).status).toBe(200);
  });

  it('galat yang memuat teks bermusuhan tampil ter-escape', async () => {
    const { app } = makeApp();
    const res = await post(app, '/admin/siklus', await sessionCookie(app, ADMIN), unggahan({ ekor: [{ tag: jahat, kg: 10, loinKg: 99, grade: 'B' }] }));
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).not.toMatch(/<script/i);
    expect(body).toContain('&lt;script&gt;');
  });

  it('data bermusuhan yang sah tersimpan apa adanya tetapi tampil ter-escape di semua halaman', async () => {
    const { app } = makeApp();
    const admin = await sessionCookie(app, ADMIN);
    const owner = await sessionCookie(app, OWNER);
    const res = await post(
      app,
      '/admin/siklus',
      admin,
      unggahan({
        pembeli: jahat,
        ekor: [{ tag: jahat, kg: 44, loinKg: 27.75, grade: '"><img src=x onerror=alert(1)>' }],
        penjualan: [{ nama: '"><img src=x onerror=alert(1)>', kg: 25, harga: 140000 }],
        biaya: [{ nama: jahat, rp: 1000 }],
        langkah: [{ judul: jahat, isi: jahat, status: 'berjalan' }],
      }),
    );
    expect(res.status).toBe(303);
    for (const [path, cookie] of [['/', owner], ['/siklus/1', owner], ['/admin', admin]] as const) {
      const body = await (await get(app, path, cookie)).text();
      expect(body, path).not.toMatch(/<script/i);
      expect(body, path).not.toContain('<img src=x');
      expect(body, path).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    }
  });
});

describe('hapus siklus', () => {
  it('admin menghapus siklus', async () => {
    const { app, siklus } = makeApp();
    await siklus.put(siklusContoh({ no: 2 }), { timpa: false });
    const res = await post(app, '/admin/siklus/2/hapus', await sessionCookie(app, ADMIN));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin?removed=1');
    expect(await siklus.list()).toEqual([]);
  });

  it.each(['9', '0', '01', '10000', 'abc', '1.5', '-1', '..%2Findex'])('nomor %s menghasilkan 404 tanpa mengubah apa pun', async (no) => {
    const { app, siklus } = makeApp();
    await siklus.put(siklusContoh({ no: 2 }), { timpa: false });
    expect((await post(app, `/admin/siklus/${no}/hapus`, await sessionCookie(app, ADMIN))).status).toBe(404);
    expect(await siklus.list()).toHaveLength(1);
  });
});

describe('dana investor', () => {
  it('admin menambah dana; jumlah bertitik diterima dan tampil di Ringkasan untuk owner', async () => {
    const { app, dana } = makeApp();
    const admin = await sessionCookie(app, ADMIN);
    const res = await post(app, '/admin/dana', admin, formDana(danaOk), urlenc);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin?dana=1');
    const [entri] = await dana.list();
    expect(entri).toMatchObject({ tanggal: '2026-10-06', jumlah: 1367000000, keterangan: 'Kas produksi' });

    const owner = await sessionCookie(app, OWNER);
    expect(await (await get(app, '/', owner)).text()).toContain('Dana investor');
    expect(await (await get(app, '/admin?dana=1', admin)).text()).toContain('Dana ditambahkan.');
  });

  it.each([
    ['tanggal 30 Februari', { ...danaOk, tanggal: '2026-02-30' }, 'Tanggal'],
    ['tanggal hilang', { jumlah: '1000' }, 'Tanggal'],
    ['jumlah huruf', { ...danaOk, jumlah: 'abc' }, 'Jumlah'],
    ['jumlah nol', { ...danaOk, jumlah: '0' }, 'Jumlah'],
    ['jumlah desimal', { ...danaOk, jumlah: '1,5' }, 'Jumlah'],
    ['jumlah negatif', { ...danaOk, jumlah: '-5' }, 'Jumlah'],
    ['jumlah 14 angka', { ...danaOk, jumlah: '10000000000000' }, 'Jumlah'],
    ['keterangan 201 karakter', { ...danaOk, keterangan: 'k'.repeat(201) }, 'Keterangan'],
  ])('menolak %s dan tidak menyimpan apa pun', async (_label, isian, pesan) => {
    const { app, dana } = makeApp();
    const res = await post(app, '/admin/dana', await sessionCookie(app, ADMIN), formDana(isian), urlenc);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain(pesan);
    expect(await dana.list()).toEqual([]);
  });

  it('menolak entri ke-201', async () => {
    const { app, dana, backend } = makeApp();
    const awal = Array.from({ length: 200 }, (_v, i) => ({ id: `dana-${String(i).padStart(4, '0')}`, tanggal: '2026-10-05', jumlah: 1, keterangan: '' }));
    await backend.write('data/dana.json', JSON.stringify(awal));
    const res = await post(app, '/admin/dana', await sessionCookie(app, ADMIN), formDana(danaOk), urlenc);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('batas');
    expect(await dana.list()).toHaveLength(200);
  });

  it('keterangan bermusuhan tersimpan tetapi tampil ter-escape', async () => {
    const { app } = makeApp();
    const admin = await sessionCookie(app, ADMIN);
    await post(app, '/admin/dana', admin, formDana({ ...danaOk, keterangan: jahat }), urlenc);
    for (const path of ['/', '/admin']) {
      const body = await (await get(app, path, admin)).text();
      expect(body, path).not.toMatch(/<script/i);
      expect(body, path).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    }
  });

  it('admin menghapus dana', async () => {
    const { app, dana } = makeApp();
    const entri = await dana.add({ tanggal: '2026-10-06', jumlah: 1000, keterangan: '' });
    const res = await post(app, `/admin/dana/${entri.id}/hapus`, await sessionCookie(app, ADMIN));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin?danahapus=1');
    expect(await dana.list()).toEqual([]);
  });

  it.each(['tidak-ada-1', '..%2Findex', 'pendek', 'x'.repeat(40)])('ID %s menghasilkan 404 tanpa mengubah apa pun', async (id) => {
    const { app, dana } = makeApp();
    await dana.add({ tanggal: '2026-10-06', jumlah: 1000, keterangan: '' });
    expect((await post(app, `/admin/dana/${id}/hapus`, await sessionCookie(app, ADMIN))).status).toBe(404);
    expect(await dana.list()).toHaveLength(1);
  });
});

describe('otorisasi dan CSRF', () => {
  const aksi = (id: string) => [
    ['unggah siklus', '/admin/siklus', () => unggahan({ no: 9 }), {}],
    ['hapus siklus', '/admin/siklus/1/hapus', () => undefined, {}],
    ['tambah dana', '/admin/dana', () => formDana(danaOk), urlenc],
    ['hapus dana', `/admin/dana/${id}/hapus`, () => undefined, {}],
  ] as const;

  async function siapkan() {
    const harness = makeApp();
    await harness.siklus.put(siklusContoh({ no: 1, pembeli: 'Aman' }), { timpa: false });
    const entri = await harness.dana.add({ tanggal: '2026-10-06', jumlah: 1000, keterangan: 'Aman' });
    return { ...harness, danaId: entri.id };
  }
  async function tidakBerubah(h: Awaited<ReturnType<typeof siapkan>>) {
    expect((await h.siklus.list()).map((s) => [s.no, s.pembeli])).toEqual([[1, 'Aman']]);
    expect((await h.dana.list()).map((d) => d.id)).toEqual([h.danaId]);
  }

  it('owner mendapat 403 di semua POST admin dan tidak ada yang berubah', async () => {
    const h = await siapkan();
    const owner = await sessionCookie(h.app, OWNER);
    for (const [label, path, buatBody, header] of aksi(h.danaId)) {
      expect((await post(h.app, path, owner, buatBody(), header)).status, label).toBe(403);
    }
    await tidakBerubah(h);
  });

  it('tanpa sesi: semua POST admin ditolak 401', async () => {
    const h = await siapkan();
    for (const [label, path, buatBody, header] of aksi(h.danaId)) {
      const res = await h.app.request(path, { method: 'POST', body: buatBody(), headers: { origin: 'http://localhost', ...header } });
      expect(res.status, label).toBe(401);
    }
    await tidakBerubah(h);
  });

  it.each([
    ['origin lain', { origin: 'https://situs-jahat.example' }],
    ['tanpa origin', { origin: '' }],
  ])('POST lintas situs dengan cookie admin sah ditolak (%s) dan tidak mengubah apa pun', async (_label, lintas) => {
    const h = await siapkan();
    const admin = await sessionCookie(h.app, ADMIN);
    for (const [label, path, buatBody, header] of aksi(h.danaId)) {
      expect((await post(h.app, path, admin, buatBody(), { ...header, ...lintas })).status, label).toBe(403);
    }
    await tidakBerubah(h);
  });
});
