// src/siklus/validasi.ts
import type { Biaya, Dana, Ekor, Langkah, Penjualan, Siklus } from './types';

export const NO_MAKS = 9999;
const TEKS_MAKS = 200;
const ISI_MAKS = 1000;
const EKOR_MAKS = 500;
const DAFTAR_MAKS = 50;
const BERAT_MAKS = 1_000_000;
const HARGA_MAKS = 1_000_000;
const RUPIAH_MAKS = 1_000_000_000_000;
const GALAT_MAKS = 10;

type Rec = Record<string, unknown>;
const isRec = (x: unknown): x is Rec => x !== null && typeof x === 'object' && !Array.isArray(x);

// Regex saja menerima 2026-02-30; tanggal yang sah harus kembali ke dirinya sendiri.
export function tanggalSah(d: unknown): d is string {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

export type HasilSiklus = { ok: true; siklus: Siklus } | { ok: false; galat: string[] };

export function parseSiklus(teksJson: string): HasilSiklus {
  let data: unknown;
  try {
    data = JSON.parse(teksJson);
  } catch {
    return { ok: false, galat: ['Berkas bukan JSON yang valid.'] };
  }
  if (!isRec(data)) {
    return { ok: false, galat: ['Isi berkas harus satu objek siklus, bukan daftar atau nilai tunggal.'] };
  }

  const galat: string[] = [];
  const no = data.no;
  const nomorSah = typeof no === 'number' && Number.isInteger(no) && no >= 1 && no <= NO_MAKS;
  const di = nomorSah ? `Siklus ${no}` : 'Siklus';
  const salah = (pesan: string) => {
    galat.push(`${di}: ${pesan}`);
  };

  const teks = (nilai: unknown, nama: string, maks = TEKS_MAKS): string => {
    if (typeof nilai !== 'string' || nilai.trim() === '') {
      salah(`${nama} wajib diisi sebagai teks.`);
      return '';
    }
    const bersih = nilai.trim();
    if (bersih.length > maks) {
      salah(`${nama} terlalu panjang (maksimal ${maks} karakter).`);
      return '';
    }
    return bersih;
  };
  const berat = (nilai: unknown, nama: string, nolBoleh = false): number => {
    const sah = typeof nilai === 'number' && Number.isFinite(nilai) && (nolBoleh ? nilai >= 0 : nilai > 0) && nilai <= BERAT_MAKS;
    if (!sah) {
      salah(`${nama} harus angka ${nolBoleh ? '>= 0' : 'positif'} dan paling besar ${BERAT_MAKS}.`);
      return 0;
    }
    return nilai as number;
  };
  const rupiah = (nilai: unknown, nama: string, maks: number): number => {
    if (!(typeof nilai === 'number' && Number.isInteger(nilai) && nilai >= 0 && nilai <= maks)) {
      salah(`${nama} harus bilangan bulat rupiah tanpa titik (140000, bukan "140.000"), paling besar ${maks}.`);
      return 0;
    }
    return nilai;
  };
  const daftar = (nilai: unknown, nama: string, maks: number): (Rec | null)[] => {
    if (!Array.isArray(nilai)) {
      salah(`${nama} harus berupa daftar.`);
      return [];
    }
    if (nilai.length > maks) {
      salah(`${nama} terlalu banyak (maksimal ${maks} baris).`);
      return [];
    }
    return nilai.map((x, i) => {
      if (isRec(x)) return x;
      salah(`${nama} ke-${i + 1} kosong atau bukan objek.`);
      return null;
    });
  };

  if (!nomorSah) salah(`nomor (no) harus bilangan bulat 1 sampai ${NO_MAKS}.`);

  const produksi = data.produksi;
  if (!tanggalSah(produksi)) salah('tanggal produksi harus tanggal yang ada, berbentuk YYYY-MM-DD.');
  const kirim = data.kirim;
  const adaKirim = kirim !== undefined && kirim !== null && kirim !== '';
  if (adaKirim && !tanggalSah(kirim)) salah('tanggal kirim harus tanggal yang ada, berbentuk YYYY-MM-DD, atau kosong.');
  const pembeli = teks(data.pembeli, 'pembeli');

  const ekor: Ekor[] = [];
  daftar(data.ekor, 'ekor', EKOR_MAKS).forEach((e, i) => {
    if (!e) return;
    const tagInfo = typeof e.tag === 'string' ? ` (tag ${e.tag.trim().slice(0, 20)})` : '';
    const nama = `ekor ke-${i + 1}${tagInfo}`;
    const tag = teks(e.tag, `${nama}: tag`);
    const kgIkan = berat(e.kg, `${nama}: kg`);
    const loinKg = berat(e.loinKg, `${nama}: kg loin`, true);
    if (kgIkan > 0 && loinKg > kgIkan) salah(`${nama}: kg loin ${loinKg} lebih besar dari berat ekornya ${kgIkan}.`);
    ekor.push({ tag, kg: kgIkan, loinKg, grade: teks(e.grade, `${nama}: grade`) });
  });

  const penjualan: Penjualan[] = [];
  daftar(data.penjualan, 'penjualan', DAFTAR_MAKS).forEach((p, i) => {
    if (!p) return;
    const nama = `penjualan ke-${i + 1}`;
    penjualan.push({
      nama: teks(p.nama, `${nama}: nama`),
      kg: berat(p.kg, `${nama}: kg`),
      harga: rupiah(p.harga, `${nama}: harga`, HARGA_MAKS),
    });
  });

  const biaya: Biaya[] = [];
  daftar(data.biaya, 'biaya', DAFTAR_MAKS).forEach((b, i) => {
    if (!b) return;
    const nama = `biaya ke-${i + 1}`;
    biaya.push({ nama: teks(b.nama, `${nama}: nama`), rp: rupiah(b.rp, `${nama}: rp`, RUPIAH_MAKS) });
  });

  const langkah: Langkah[] = [];
  daftar(data.langkah, 'langkah', DAFTAR_MAKS).forEach((l, i) => {
    if (!l) return;
    const nama = `langkah ke-${i + 1}`;
    const judul = teks(l.judul, `${nama}: judul`);
    const status = l.status;
    if (status !== 'selesai' && status !== 'berjalan') {
      salah(`${nama}: status harus "selesai" atau "berjalan".`);
      return;
    }
    const adaIsi = l.isi !== undefined && l.isi !== null && l.isi !== '';
    const isi = adaIsi ? teks(l.isi, `${nama}: isi`, ISI_MAKS) : '';
    langkah.push(isi ? { judul, isi, status } : { judul, status });
  });

  if (galat.length > 0) return { ok: false, galat: galat.slice(0, GALAT_MAKS) };
  return {
    ok: true,
    siklus: {
      no: no as number,
      produksi: produksi as string,
      ...(adaKirim ? { kirim: kirim as string } : {}),
      pembeli,
      ekor,
      penjualan,
      biaya,
      langkah,
    },
  };
}

export type HasilDana = { ok: true; dana: Omit<Dana, 'id'> } | { ok: false; galat: string[] };

export function parseDana(input: { tanggal?: unknown; jumlah?: unknown; keterangan?: unknown }): HasilDana {
  const galat: string[] = [];

  const tanggal = typeof input.tanggal === 'string' ? input.tanggal.trim() : '';
  if (!tanggalSah(tanggal)) galat.push('Tanggal dana harus tanggal yang ada, berbentuk YYYY-MM-DD.');

  // Titik ribuan dan spasi dibuang agar "1.367.000.000" yang diketik admin diterima.
  const angka = typeof input.jumlah === 'string' ? input.jumlah.replace(/[.\s]/g, '') : '';
  const jumlah = /^[0-9]{1,13}$/.test(angka) ? Number(angka) : 0;
  if (jumlah <= 0) {
    galat.push('Jumlah dana harus bilangan bulat rupiah lebih dari 0, maksimal 13 angka (contoh 1.367.000.000).');
  }

  const keterangan = typeof input.keterangan === 'string' ? input.keterangan.trim() : '';
  if (keterangan.length > TEKS_MAKS) galat.push(`Keterangan dana maksimal ${TEKS_MAKS} karakter.`);

  if (galat.length > 0) return { ok: false, galat };
  return { ok: true, dana: { tanggal, jumlah, keterangan } };
}
