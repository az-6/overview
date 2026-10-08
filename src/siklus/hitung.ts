// src/siklus/hitung.ts
import type { Dana, Penjualan, Siklus } from './types';

// Satu-satunya tempat rumus dasbor hidup. Port dari investor/hitung.js; murni, tanpa dependensi.
const jumlah = <T>(daftar: T[], f: (x: T) => number) => daftar.reduce((total, x) => total + f(x), 0);
const nilaiBaris = (p: Penjualan) => Math.round(p.kg * p.harga);
const bagi = (a: number, b: number): number | null => (b ? a / b : null);

export interface RingkasanSiklus {
  ekor: number;
  kgIkan: number;
  kgLoin: number;
  pendapatan: number;
  biaya: number;
  laba: number;
  yield: number | null;
  margin: number | null;
  hppPerKgLoin: number | null;
  hargaRataLoin: number | null;
}

export function ringkasSiklus(s: Siklus): RingkasanSiklus {
  const kgIkan = jumlah(s.ekor, (e) => e.kg);
  const kgLoin = jumlah(s.ekor, (e) => e.loinKg);
  const pendapatan = jumlah(s.penjualan, nilaiBaris);
  const biaya = jumlah(s.biaya, (b) => b.rp);
  const laba = pendapatan - biaya;
  const loin = s.penjualan.filter((p) => p.nama.startsWith('Loin'));
  return {
    ekor: s.ekor.length,
    kgIkan,
    kgLoin,
    pendapatan,
    biaya,
    laba,
    yield: bagi(kgLoin, kgIkan),
    margin: bagi(laba, pendapatan),
    hppPerKgLoin: bagi(biaya, kgLoin),
    hargaRataLoin: bagi(jumlah(loin, nilaiBaris), jumlah(loin, (p) => p.kg)),
  };
}

export interface RingkasanSemua {
  siklus: number;
  ekor: number;
  kgIkan: number;
  kgLoin: number;
  pendapatan: number;
  biaya: number;
  laba: number;
  yield: number | null;
  margin: number | null;
}

export function ringkasSemua(daftar: Siklus[]): RingkasanSemua {
  const r = daftar.map(ringkasSiklus);
  const total = (k: 'ekor' | 'kgIkan' | 'kgLoin' | 'pendapatan' | 'biaya' | 'laba') => jumlah(r, (x) => x[k]);
  const kgIkan = total('kgIkan');
  const kgLoin = total('kgLoin');
  const pendapatan = total('pendapatan');
  const laba = total('laba');
  return {
    siklus: daftar.length,
    ekor: total('ekor'),
    kgIkan,
    kgLoin,
    pendapatan,
    biaya: total('biaya'),
    laba,
    yield: bagi(kgLoin, kgIkan),
    margin: bagi(laba, pendapatan),
  };
}

export interface PosisiDana {
  diterima: number;
  terpakai: number;
  kembali: number;
  sisa: number;
  imbal: number | null;
}

// Sisa = dana - biaya + pendapatan: anggapan semua penjualan dibayar dan semua biaya lunas.
export function posisiDana(dana: Dana[], daftar: Siklus[]): PosisiDana | null {
  if (dana.length === 0) return null;
  const t = ringkasSemua(daftar);
  const diterima = jumlah(dana, (x) => x.jumlah);
  return {
    diterima,
    terpakai: t.biaya,
    kembali: t.pendapatan,
    sisa: diterima - t.biaya + t.pendapatan,
    imbal: bagi(t.laba, diterima),
  };
}

const angka = (n: number, d: number) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const ringkas = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 });

export const rp = (n: number) => (n < 0 ? '−' : '') + 'Rp ' + Math.abs(n).toLocaleString('id-ID');
export const rpRingkas = (n: number) => (n < 0 ? '−' : '') + 'Rp ' + ringkas.format(Math.abs(n));
export const kg = (n: number, d = 2) => angka(n, d) + ' kg';
export const persen = (x: number | null, d = 1) => (x == null ? '—' : angka(x * 100, d) + ' %');
