// tests/validasi.test.ts
import { describe, expect, it } from 'vitest';
import { parseDana, parseSiklus } from '../src/siklus/validasi';
import { siklusContoh } from './fixtures';

const galat = (data: unknown): string[] => {
  const hasil = parseSiklus(typeof data === 'string' ? data : JSON.stringify(data));
  if (hasil.ok) throw new Error('seharusnya ditolak');
  return hasil.galat;
};
const sah = (data: unknown) => {
  const hasil = parseSiklus(JSON.stringify(data));
  if (!hasil.ok) throw new Error(hasil.galat.join('; '));
  return hasil.siklus;
};
const ekorOk = { tag: '001', kg: 44, loinKg: 27.75, grade: 'B' };

describe('parseSiklus: menerima dan menormalisasi', () => {
  it('menerima siklus sah apa adanya', () => {
    expect(sah(siklusContoh())).toEqual(siklusContoh());
  });

  it('memangkas spasi dan membuang kunci yang tidak dikenal', () => {
    const hasil = sah({
      ...siklusContoh(),
      pembeli: '  PT Uji  ',
      ekstra: 1,
      ekor: [{ tag: ' 001 ', kg: 44, loinKg: 27.75, grade: ' B ', rahasia: 'x' }],
    });
    expect(hasil).toEqual(siklusContoh());
  });

  it('kirim kosong atau hilang tidak disimpan; isi langkah opsional', () => {
    expect('kirim' in sah({ ...siklusContoh(), kirim: '' })).toBe(false);
    expect('kirim' in sah({ ...siklusContoh(), kirim: null })).toBe(false);
    const { kirim: _kirim, ...tanpaKirim } = siklusContoh();
    expect('kirim' in sah(tanpaKirim)).toBe(false);
    const langkah = sah({ ...siklusContoh(), langkah: [{ judul: 'A', isi: '', status: 'selesai' }, { judul: 'B', status: 'berjalan' }] }).langkah;
    expect(langkah).toEqual([{ judul: 'A', status: 'selesai' }, { judul: 'B', status: 'berjalan' }]);
  });

  it('membuang __proto__ dan constructor tanpa mencemari prototipe', () => {
    const teks = JSON.stringify(siklusContoh()).replace('{', '{"__proto__":{"admin":true},"constructor":{"x":1},');
    const hasil = parseSiklus(teks);
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(Object.prototype.hasOwnProperty.call(hasil.siklus, '__proto__')).toBe(false);
    expect(Object.keys(hasil.siklus).sort()).toEqual(['biaya', 'ekor', 'kirim', 'langkah', 'no', 'pembeli', 'penjualan', 'produksi']);
    expect(({} as { admin?: boolean }).admin).toBeUndefined();
  });

  it('menerima batas atas: 500 ekor, teks 200 karakter, isi 1000, 50 baris tiap daftar', () => {
    const hasil = sah(
      siklusContoh({
        pembeli: 'p'.repeat(200),
        ekor: Array.from({ length: 500 }, (_v, i) => ({ ...ekorOk, tag: String(i) })),
        penjualan: Array.from({ length: 50 }, () => ({ nama: 'Loin', kg: 1_000_000, harga: 1_000_000 })),
        biaya: Array.from({ length: 50 }, () => ({ nama: 'B', rp: 1_000_000_000_000 })),
        langkah: Array.from({ length: 50 }, () => ({ judul: 'j'.repeat(200), isi: 'i'.repeat(1000), status: 'selesai' as const })),
        no: 9999,
      }),
    );
    expect(hasil.ekor).toHaveLength(500);
    expect(hasil.no).toBe(9999);
  });
});

describe('parseSiklus: menolak', () => {
  it.each([
    ['bukan JSON', '{rusak', /bukan JSON/],
    ['larik', '[]', /satu objek/],
    ['null', 'null', /satu objek/],
    ['angka tunggal', '5', /satu objek/],
    ['teks tunggal', '"halo"', /satu objek/],
    ['no 0', siklusContoh({ no: 0 }), /nomor/],
    ['no 10000', siklusContoh({ no: 10000 }), /nomor/],
    ['no desimal', siklusContoh({ no: 1.5 }), /nomor/],
    ['no berupa teks', { ...siklusContoh(), no: '1' }, /nomor/],
    ['produksi 30 Februari', siklusContoh({ produksi: '2026-02-30' }), /tanggal produksi/],
    ['produksi format salah', siklusContoh({ produksi: '3/10/2026' }), /tanggal produksi/],
    ['kirim bulan 13', siklusContoh({ kirim: '2026-13-01' }), /tanggal kirim/],
    ['pembeli kosong', siklusContoh({ pembeli: '   ' }), /pembeli/],
    ['pembeli bukan teks', { ...siklusContoh(), pembeli: 7 }, /pembeli/],
    ['pembeli 201 karakter', siklusContoh({ pembeli: 'p'.repeat(201) }), /terlalu panjang/],
    ['ekor bukan daftar', { ...siklusContoh(), ekor: {} }, /ekor harus berupa daftar/],
    ['ekor berisi null', { ...siklusContoh(), ekor: [null] }, /ekor ke-1 kosong/],
    ['ekor tanpa daftar sama sekali', { ...siklusContoh(), ekor: undefined }, /ekor harus berupa daftar/],
    ['kg loin melebihi berat', siklusContoh({ ekor: [{ tag: '003', kg: 39, loinKg: 40, grade: 'C' }] }), /ekor ke-1 \(tag 003\).*kg loin 40 lebih besar dari berat ekornya 39/],
    ['kg nol', siklusContoh({ ekor: [{ ...ekorOk, kg: 0 }] }), /kg harus angka positif/],
    ['kg negatif', siklusContoh({ ekor: [{ ...ekorOk, kg: -3 }] }), /kg harus angka positif/],
    ['kg di atas batas', siklusContoh({ ekor: [{ ...ekorOk, kg: 1_000_001 }] }), /paling besar/],
    ['kg berupa teks', { ...siklusContoh(), ekor: [{ ...ekorOk, kg: '44' }] }, /kg harus angka/],
    ['loinKg negatif', siklusContoh({ ekor: [{ ...ekorOk, loinKg: -1 }] }), /kg loin harus angka/],
    ['tag kosong', siklusContoh({ ekor: [{ ...ekorOk, tag: ' ' }] }), /tag wajib/],
    ['grade kosong', siklusContoh({ ekor: [{ ...ekorOk, grade: '' }] }), /grade wajib/],
    ['harga berupa teks bertitik', { ...siklusContoh(), penjualan: [{ nama: 'Loin', kg: 1, harga: '140.000' }] }, /harga harus bilangan bulat/],
    ['harga desimal', siklusContoh({ penjualan: [{ nama: 'Loin', kg: 1, harga: 10.5 }] }), /harga harus bilangan bulat/],
    ['harga negatif', siklusContoh({ penjualan: [{ nama: 'Loin', kg: 1, harga: -1 }] }), /harga harus bilangan bulat/],
    ['nama penjualan bukan teks', { ...siklusContoh(), penjualan: [{ nama: 5, kg: 1, harga: 1 }] }, /nama wajib/],
    ['kg penjualan nol', siklusContoh({ penjualan: [{ nama: 'Loin', kg: 0, harga: 1 }] }), /kg harus angka positif/],
    ['rp desimal', siklusContoh({ biaya: [{ nama: 'Ikan', rp: 10.5 }] }), /rp harus bilangan bulat/],
    ['rp di atas batas', siklusContoh({ biaya: [{ nama: 'Ikan', rp: 1_000_000_000_001 }] }), /rp harus bilangan bulat/],
    ['status tidak dikenal', { ...siklusContoh(), langkah: [{ judul: 'a', status: 'nanti' }] }, /status harus/],
    ['judul langkah kosong', { ...siklusContoh(), langkah: [{ judul: '', status: 'selesai' }] }, /judul wajib/],
    ['isi langkah 1001 karakter', { ...siklusContoh(), langkah: [{ judul: 'a', isi: 'i'.repeat(1001), status: 'selesai' }] }, /isi terlalu panjang/],
    ['501 ekor', siklusContoh({ ekor: Array.from({ length: 501 }, () => ekorOk) }), /ekor terlalu banyak/],
    ['51 biaya', siklusContoh({ biaya: Array.from({ length: 51 }, () => ({ nama: 'B', rp: 1 })) }), /biaya terlalu banyak/],
  ])('%s', (_label, data, pola) => {
    expect(galat(data).join('\n')).toMatch(pola);
  });

  it('angka tak berhingga (1e999) ditolak', () => {
    const teks = JSON.stringify(siklusContoh()).replace('"kg":44', '"kg":1e999');
    expect(teks).toContain('1e999');
    expect(galat(teks).join('\n')).toMatch(/kg harus angka positif/);
  });

  it('pesan diawali nomor siklus bila nomor sah, dan "Siklus:" bila tidak', () => {
    expect(galat(siklusContoh({ no: 7, pembeli: '' }))[0]).toMatch(/^Siklus 7: /);
    expect(galat(siklusContoh({ no: 0, pembeli: '' }))[0]).toMatch(/^Siklus: /);
  });

  it('mengumpulkan beberapa galat sekaligus dan memotong pada 10 pesan', () => {
    const buruk = Array.from({ length: 12 }, () => ({ tag: '', kg: 0, loinKg: -1, grade: '' }));
    expect(galat(siklusContoh({ ekor: buruk }))).toHaveLength(10);
    expect(galat(siklusContoh({ pembeli: '', produksi: 'x' })).length).toBe(2);
  });
});

describe('parseDana', () => {
  const sahDana = (input: Parameters<typeof parseDana>[0]) => {
    const hasil = parseDana(input);
    if (!hasil.ok) throw new Error(hasil.galat.join('; '));
    return hasil.dana;
  };
  const galatDana = (input: Parameters<typeof parseDana>[0]) => {
    const hasil = parseDana(input);
    if (hasil.ok) throw new Error('seharusnya ditolak');
    return hasil.galat.join('\n');
  };

  it('menerima isian sah, membuang titik ribuan dan spasi, memangkas keterangan', () => {
    expect(sahDana({ tanggal: '2026-10-06', jumlah: '1.367.000.000', keterangan: '  Kas produksi ' })).toEqual({
      tanggal: '2026-10-06',
      jumlah: 1367000000,
      keterangan: 'Kas produksi',
    });
    expect(sahDana({ tanggal: '2026-10-06', jumlah: ' 5 000 ', keterangan: undefined }).jumlah).toBe(5000);
  });

  it('menerima batas: 13 angka dan keterangan tepat 200 karakter', () => {
    const dana = sahDana({ tanggal: '2026-10-06', jumlah: '9999999999999', keterangan: 'k'.repeat(200) });
    expect(dana.jumlah).toBe(9_999_999_999_999);
  });

  it.each([
    ['tanggal 30 Februari', { tanggal: '2026-02-30', jumlah: '1000' }, /Tanggal/],
    ['tanggal hilang', { jumlah: '1000' }, /Tanggal/],
    ['jumlah huruf', { tanggal: '2026-10-06', jumlah: 'abc' }, /Jumlah/],
    ['jumlah nol', { tanggal: '2026-10-06', jumlah: '0' }, /Jumlah/],
    ['jumlah desimal koma', { tanggal: '2026-10-06', jumlah: '1,5' }, /Jumlah/],
    ['jumlah negatif', { tanggal: '2026-10-06', jumlah: '-5' }, /Jumlah/],
    ['jumlah 14 angka', { tanggal: '2026-10-06', jumlah: '10000000000000' }, /Jumlah/],
    ['jumlah kosong', { tanggal: '2026-10-06', jumlah: '' }, /Jumlah/],
    ['jumlah bukan teks', { tanggal: '2026-10-06', jumlah: 1000 }, /Jumlah/],
    ['keterangan 201 karakter', { tanggal: '2026-10-06', jumlah: '1000', keterangan: 'k'.repeat(201) }, /Keterangan/],
  ])('menolak %s', (_label, input, pola) => {
    expect(galatDana(input)).toMatch(pola);
  });

  it('mengumpulkan semua galat isian', () => {
    expect(galatDana({ tanggal: 'x', jumlah: 'y', keterangan: 'k'.repeat(201) }).split('\n')).toHaveLength(3);
  });
});
