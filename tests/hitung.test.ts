// tests/hitung.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { kg, persen, posisiDana, ringkasSemua, ringkasSiklus, rp, rpRingkas } from '../src/siklus/hitung';
import type { Dana, Siklus } from '../src/siklus/types';

const contoh = JSON.parse(readFileSync('samples/siklus-contoh.json', 'utf8')) as Siklus;
const ekor = (berat: number, loinKg: number, grade = 'B') => ({ tag: 'x', kg: berat, loinKg, grade });
const dasar = (o: Partial<Siklus> = {}): Siklus => ({
  no: 1,
  produksi: '2026-10-03',
  pembeli: 'PT Uji',
  ekor: [ekor(40, 25)],
  penjualan: [{ nama: 'Loin B-SO', kg: 25, harga: 140000 }],
  biaya: [{ nama: 'Ikan', rp: 1000000 }],
  langkah: [],
  ...o,
});
const pct = (x: number | null) => Math.round((x ?? 0) * 1000) / 10;
const dana = (jumlah: number): Dana => ({ id: 'dana-0001', tanggal: '2026-10-06', jumlah, keterangan: 'Uji' });

describe('ringkasSiklus', () => {
  it('siklus contoh cocok dengan angka laporan', () => {
    const r = ringkasSiklus(contoh);
    expect(r.pendapatan).toBe(41576150);
    expect(r.biaya).toBe(37072682);
    expect(r.laba).toBe(4503468);
    expect(pct(r.yield)).toBe(62.6);
    expect(r.ekor).toBe(11);
  });

  it('pendapatan dibulatkan per baris', () => {
    const s = dasar({ penjualan: [{ nama: 'Loin', kg: 0.5, harga: 3 }, { nama: 'Loin', kg: 0.5, harga: 3 }] });
    expect(ringkasSiklus(s).pendapatan).toBe(4); // 2 + 2, bukan round(3)
  });

  it('harga rata-rata loin hanya dari pos berawalan Loin', () => {
    const s = dasar({
      penjualan: [
        { nama: 'Loin B-SO', kg: 10, harga: 140000 },
        { nama: 'Loin C-SO', kg: 10, harga: 120000 },
        { nama: 'Kepala', kg: 100, harga: 5000 },
      ],
    });
    expect(ringkasSiklus(s).hargaRataLoin).toBe(130000);
  });

  it('rugi menghasilkan laba dan margin negatif', () => {
    const r = ringkasSiklus(dasar({ biaya: [{ nama: 'Ikan', rp: 9000000 }] }));
    expect(r.laba).toBe(3500000 - 9000000);
    expect(r.margin).toBeLessThan(0);
  });

  it('siklus kosong menghasilkan null, bukan NaN', () => {
    const r = ringkasSiklus(dasar({ ekor: [], penjualan: [], biaya: [] }));
    expect(r.yield).toBeNull();
    expect(r.margin).toBeNull();
    expect(r.hppPerKgLoin).toBeNull();
    expect(r.hargaRataLoin).toBeNull();
    expect(persen(r.yield)).toBe('—');
    expect(ringkasSemua([]).yield).toBeNull();
  });
});

describe('ringkasSemua', () => {
  it('total lintas siklus tertimbang berat, bukan rata-rata persen', () => {
    const t = ringkasSemua([dasar({ no: 1, ekor: [ekor(100, 60)] }), dasar({ no: 2, ekor: [ekor(10, 2)] })]);
    expect(pct(t.yield)).toBe(56.4); // 62/110, bukan (60% + 20%) / 2
    expect(t.siklus).toBe(2);
  });
});

describe('posisiDana', () => {
  it('menghitung posisi dana investor', () => {
    const p = posisiDana([dana(1367000000)], [contoh])!;
    expect(p.diterima).toBe(1367000000);
    expect(p.terpakai).toBe(37072682);
    expect(p.kembali).toBe(41576150);
    expect(p.sisa).toBe(1371503468);
    expect(persen(p.imbal, 2)).toBe('0,33 %');
    expect(Math.round((p.imbal ?? 0) * 10000) / 100).toBe(0.33);
  });

  it('menjumlahkan beberapa entri dana', () => {
    expect(posisiDana([dana(100), dana(250)], [])!.diterima).toBe(350);
  });

  it('tanpa dana hasilnya null', () => {
    expect(posisiDana([], [])).toBeNull();
    expect(posisiDana([], [contoh])).toBeNull();
  });
});

describe('pemformat', () => {
  it('rupiah, kilogram, dan persen', () => {
    expect(rp(4503468)).toBe('Rp 4.503.468');
    expect(rp(-5061890)).toBe('−Rp 5.061.890');
    expect(kg(300.94000000000005)).toBe('300,94 kg');
    expect(kg(44, 0)).toBe('44 kg');
    expect(persen(0.62566)).toBe('62,6 %');
    expect(persen(0.0033, 2)).toBe('0,33 %');
    expect(persen(null)).toBe('—');
  });

  it('rupiah ringkas', () => {
    expect(rpRingkas(27500000)).toMatch(/^Rp 27,5\sjt$/);
    expect(rpRingkas(-27500000)).toMatch(/^−Rp 27,5\sjt$/);
  });
});
