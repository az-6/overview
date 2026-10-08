// tests/views.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Dana, Siklus } from '../src/siklus/types';
import { adminPage } from '../src/views/admin';
import { detailPage } from '../src/views/detail';
import { ringkasanPage } from '../src/views/ringkasan';
import { siklusContoh } from './fixtures';

const teks = async (x: unknown) => String(await x);
const contoh = JSON.parse(readFileSync('samples/siklus-contoh.json', 'utf8')) as Siklus;
const jahat = '<script>alert(1)</script>';
const siklusJahat = () =>
  siklusContoh({
    pembeli: jahat,
    ekor: [{ tag: jahat, kg: 44, loinKg: 27.75, grade: jahat }],
    penjualan: [{ nama: '"><img src=x onerror=alert(1)>', kg: 25, harga: 140000 }],
    biaya: [{ nama: jahat, rp: 1000000 }],
    langkah: [{ judul: jahat, isi: jahat, status: 'berjalan' }],
  });
const dana = (jumlah: number, tanggal = '2026-10-06', keterangan = 'Kas produksi'): Dana => ({ id: `dana-${tanggal}-${jumlah}`.slice(0, 32), tanggal, jumlah, keterangan });

function aman(html: string) {
  expect(html).not.toMatch(/<script/i);
  expect(html).not.toContain('<img src=x');
  expect(html).not.toMatch(/onclick|innerHTML/);
  expect(html).not.toMatch(/NaN|Infinity|undefined/);
}

describe('data bermusuhan di semua halaman', () => {
  it('Ringkasan, rincian, dan admin meng-escape setiap bidang teks', async () => {
    const daftar = [siklusJahat()];
    const danaJahat = [dana(1_000_000, '2026-10-06', jahat)];
    for (const h of [
      await teks(ringkasanPage({ daftar, dana: danaJahat, peran: 'admin' })),
      await teks(detailPage({ daftar, siklus: daftar[0], peran: 'owner' })),
      await teks(adminPage({ daftar, dana: danaJahat, galatSiklus: [jahat], galatDana: [jahat], pesan: jahat })),
    ]) {
      aman(h);
      expect(h).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    }
  });

  it('atribut title pada batang yield tidak bisa keluar dari tanda kutip', async () => {
    const siklus = siklusContoh({ ekor: [{ tag: '"><b>', kg: 44, loinKg: 27.75, grade: '"x' }] });
    const h = await teks(detailPage({ daftar: [siklus], siklus, peran: 'owner' }));
    expect(h).not.toContain('"><b>');
    expect(h).toContain('&quot;&gt;&lt;b&gt;');
  });
});

describe('ringkasanPage', () => {
  it('tanpa siklus dan dana: judul kosong, tanpa NaN, tombol hanya untuk admin', async () => {
    const admin = await teks(ringkasanPage({ daftar: [], dana: [], peran: 'admin' }));
    const owner = await teks(ringkasanPage({ daftar: [], dana: [], peran: 'owner' }));
    for (const h of [admin, owner]) {
      aman(h);
      expect(h).toContain('Belum ada siklus produksi');
      expect(h).not.toContain('Dana investor');
    }
    expect(admin).toContain('Tambah siklus');
    expect(admin).toContain('href="/admin"');
    expect(owner).not.toContain('Tambah siklus');
    expect(owner).not.toContain('/admin');
  });

  it('dengan siklus: judul, kartu angka, tautan ke rincian, dan tanpa onclick', async () => {
    const h = await teks(ringkasanPage({ daftar: [contoh], dana: [], peran: 'owner' }));
    aman(h);
    expect(h).toContain('Ringkasan · 1 siklus produksi');
    expect(h).toContain('laba Rp 4.503.468');
    expect(h).toContain('href="/siklus/1"');
    expect(h).toContain('Yield 62,6 %');
    expect(h).toContain('Daftar siklus');
    expect(h).not.toContain('Tambah siklus');
    expect(h).not.toContain('Dana investor');
  });

  it('admin melihat tombol Tambah siklus di daftar siklus', async () => {
    const h = await teks(ringkasanPage({ daftar: [contoh], dana: [], peran: 'admin' }));
    expect(h).toContain('Tambah siklus');
    expect(h).toContain('href="/admin"');
  });

  it('bagian Dana investor: angka sesuai contoh pemilik, sama untuk kedua peran', async () => {
    const entri = [dana(1367000000)];
    const admin = await teks(ringkasanPage({ daftar: [contoh], dana: entri, peran: 'admin' }));
    const owner = await teks(ringkasanPage({ daftar: [contoh], dana: entri, peran: 'owner' }));
    for (const h of [admin, owner]) {
      aman(h);
      expect(h).toContain('Dana investor');
      expect(h).toContain('Sisa dana Rp 1.371.503.468 dari Rp 1.367.000.000 yang diterima');
      expect(h).toContain('0,33 %');
      expect(h).toContain('dengan anggapan seluruh penjualan sudah dibayar');
      expect(h).toContain('Diterima 6 Oktober 2026');
    }
  });

  it('beberapa entri dana tampil sebagai tabel, urutan sesuai masukan', async () => {
    const h = await teks(ringkasanPage({ daftar: [contoh], dana: [dana(100, '2026-10-05', 'Tahap satu'), dana(200, '2026-10-07', 'Tahap dua')], peran: 'owner' }));
    expect(h).toContain('Tahap satu');
    expect(h).toContain('Tahap dua');
    expect(h.indexOf('Tahap satu')).toBeLessThan(h.indexOf('Tahap dua'));
    expect(h).toContain('Rp 300');
  });

  it('bilah pemakaian dana dibatasi 100 % bila biaya melebihi dana', async () => {
    const h = await teks(ringkasanPage({ daftar: [contoh], dana: [dana(1)], peran: 'owner' }));
    expect(h).toContain('style="width:100%"');
    aman(h);
  });

  it('dana tanpa siklus tetap tampil tanpa NaN', async () => {
    const h = await teks(ringkasanPage({ daftar: [], dana: [dana(5000)], peran: 'owner' }));
    aman(h);
    expect(h).toContain('Sisa dana Rp 5.000 dari Rp 5.000 yang diterima');
  });

  it('rugi memakai kata Rugi dan kelas turun', async () => {
    const rugi = siklusContoh({ biaya: [{ nama: 'Ikan', rp: 99_000_000 }] });
    const h = await teks(ringkasanPage({ daftar: [rugi], dana: [], peran: 'owner' }));
    expect(h).toContain('rugi Rp');
    expect(h).toContain('class="v turun"');
  });
});

describe('detailPage', () => {
  it('menampilkan judul, tabel keuangan, struktur biaya, dan langkah', async () => {
    const h = await teks(detailPage({ daftar: [contoh], siklus: contoh, peran: 'owner' }));
    aman(h);
    expect(h).toContain('Siklus 1: yield 62,6 %, laba Rp 4.503.468');
    expect(h).toContain('11 ekor tuna menjadi');
    expect(h).toContain('Yield per ekor');
    expect(h).toContain('Pendapatan dan biaya');
    expect(h).toContain('Ke mana biayanya pergi');
    expect(h).toContain('Tindak lanjut');
    expect(h).toContain('class="chip berjalan"');
    expect(h).toContain('class="chip selesai"');
    expect(h).toContain('aria-current="page"');
  });

  it('tautan siklus sebelumnya dan berikutnya', async () => {
    const daftar = [siklusContoh({ no: 1 }), siklusContoh({ no: 2 }), siklusContoh({ no: 3 })];
    const tengah = await teks(detailPage({ daftar, siklus: daftar[1], peran: 'owner' }));
    expect(tengah).toContain('← Siklus 1');
    expect(tengah).toContain('Siklus 3 →');
    const pertama = await teks(detailPage({ daftar, siklus: daftar[0], peran: 'owner' }));
    expect(pertama).not.toContain('←');
    expect(pertama).toContain('Siklus 2 →');
  });

  it('siklus tanpa ekor, penjualan, biaya, dan langkah tidak menghasilkan NaN', async () => {
    const kosong = siklusContoh({ ekor: [], penjualan: [], biaya: [], langkah: [] });
    const h = await teks(detailPage({ daftar: [kosong], siklus: kosong, peran: 'owner' }));
    aman(h);
    expect(h).toContain('Belum ada ekor yang dicatat.');
    expect(h).not.toContain('Tindak lanjut');
  });

  it('lebih dari 20 ekor menyembunyikan label per batang', async () => {
    const banyak = siklusContoh({ ekor: Array.from({ length: 25 }, (_v, i) => ({ tag: String(i), kg: 40, loinKg: 24, grade: 'B' })) });
    const h = await teks(detailPage({ daftar: [banyak], siklus: banyak, peran: 'owner' }));
    expect(h).not.toContain('class="yx"');
    const sedikit = await teks(detailPage({ daftar: [contoh], siklus: contoh, peran: 'owner' }));
    expect(sedikit).toContain('class="yx"');
  });

  it('owner tidak melihat tautan admin', async () => {
    const h = await teks(detailPage({ daftar: [contoh], siklus: contoh, peran: 'owner' }));
    expect(h).not.toContain('/admin');
  });
});

describe('adminPage', () => {
  it('memuat form unggah, form dana, dan tombol hapus per baris', async () => {
    const daftar = [siklusContoh({ no: 1 }), siklusContoh({ no: 2 })];
    const entri = [{ id: 'dana-abcdef12', tanggal: '2026-10-06', jumlah: 1000, keterangan: 'Kas' }];
    const h = await teks(adminPage({ daftar, dana: entri }));
    aman(h);
    expect(h).toContain('action="/admin/siklus"');
    expect(h).toContain('enctype="multipart/form-data"');
    expect(h).toContain('name="file"');
    expect(h).toContain('name="timpa"');
    expect(h).toContain('action="/admin/siklus/1/hapus"');
    expect(h).toContain('action="/admin/siklus/2/hapus"');
    expect(h).toContain('action="/admin/dana"');
    expect(h).toContain('type="date"');
    expect(h).toContain('action="/admin/dana/dana-abcdef12/hapus"');
    expect(h).toContain('href="/admin"');
    expect(h).toContain('action="/logout"');
  });

  it('menampilkan pesan sukses dan daftar galat di bagian yang tepat', async () => {
    const h = await teks(adminPage({ daftar: [], dana: [], pesan: 'Siklus ditambahkan.', galatSiklus: ['Siklus 1: pembeli wajib diisi sebagai teks.'], galatDana: ['Jumlah dana salah.'] }));
    expect(h).toContain('Siklus ditambahkan.');
    expect(h).toContain('pembeli wajib diisi');
    expect(h).toContain('Jumlah dana salah.');
    expect(h).toContain('role="alert"');
    const polos = await teks(adminPage({ daftar: [], dana: [] }));
    expect(polos).not.toContain('role="alert"');
    expect(polos).not.toContain('role="status"');
  });

  it('keadaan kosong menyebut belum ada siklus dan dana', async () => {
    const h = await teks(adminPage({ daftar: [], dana: [] }));
    expect(h).toContain('Belum ada siklus.');
    expect(h).toContain('Belum ada dana.');
  });
});
