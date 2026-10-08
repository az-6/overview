// tests/fixtures.ts
import type { Siklus } from '../src/siklus/types';

export const siklusContoh = (o: Partial<Siklus> = {}): Siklus => ({
  no: 1,
  produksi: '2026-10-03',
  kirim: '2026-10-04',
  pembeli: 'PT Uji',
  ekor: [{ tag: '001', kg: 44, loinKg: 27.75, grade: 'B' }],
  penjualan: [{ nama: 'Loin B-SO', kg: 25, harga: 140000 }],
  biaya: [{ nama: 'Ikan utuh', rp: 1000000 }],
  langkah: [{ judul: 'Negosiasi tarif', isi: 'Tarif lebih murah', status: 'berjalan' }],
  ...o,
});
