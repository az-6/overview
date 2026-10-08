// src/siklus/types.ts
export interface Ekor {
  tag: string;
  kg: number;
  loinKg: number;
  grade: string;
}

export interface Penjualan {
  nama: string;
  kg: number;
  harga: number;
}

export interface Biaya {
  nama: string;
  rp: number;
}

export interface Langkah {
  judul: string;
  isi?: string;
  status: 'selesai' | 'berjalan';
}

export interface Siklus {
  no: number;
  produksi: string;
  kirim?: string;
  pembeli: string;
  ekor: Ekor[];
  penjualan: Penjualan[];
  biaya: Biaya[];
  langkah: Langkah[];
}

export interface Dana {
  id: string;
  tanggal: string;
  jumlah: number;
  keterangan: string;
}
