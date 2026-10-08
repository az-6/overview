# Dasbor Siklus Produksi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti portal laporan HTML dengan dasbor siklus produksi (Ringkasan, rincian siklus, Dana investor): owner hanya melihat, admin menambah/menimpa/menghapus siklus lewat unggah JSON dan menambah/menghapus dana lewat form, di `overview.katalislintasglobal.com`.

**Architecture:** Dibangun di atas Task 1–7 rencana lama (konfigurasi, sandi, sesi, pembatas login, `ObjectBackend` memori/berkas/Blob, `bootstrap`). Dua store baru (`SiklusStore`, `DanaStore`) memakai `ObjectBackend` yang sama; rumus dari `investor/hitung.js` diporting ke TypeScript; semua halaman dirender di server dengan `hono/html` tanpa JavaScript di browser. Fitur laporan HTML dihapus.

**Tech Stack:** Node >= 22, TypeScript (strict), Hono, `@vercel/blob`, Vitest, tsx, `@hono/node-server` (sudah terpasang).

**Spec:** `docs/superpowers/specs/2026-10-08-overview-siklus-design.md` (otoritas utama). Bagian yang masih berlaku dari `docs/superpowers/specs/2026-10-08-overview-reports-design.md`: bagian 3 (arsitektur dasar), 4 (login dan sesi), 8 (kegagalan konfigurasi), 10 (rilis). Bila rencana ini berbeda dari spec, spec yang berlaku.

**Keadaan awal:** Task 1–7 rencana lama selesai dan ter-commit (76 tes lolos, `HEAD` = `7974b10` atau lebih baru). Folder `investor/` ada di repo dengan perubahan pemilik yang belum di-commit; jangan ubah isinya, hanya baca (sampai Task 8).

## Global Constraints

- Semua teks antarmuka, pesan galat, dan pesan commit dalam bahasa Indonesia. Setiap commit: `git commit -m "<pesan>" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`.
- Tidak ada JavaScript di sisi browser pada halaman aplikasi: tidak ada `<script>`, `onclick`, atau `innerHTML`. Hanya form HTML dan tautan.
- Tidak ada sandi, rahasia, atau nilai env asli di repo, log, atau tes selain nilai uji yang jelas palsu.
- Env var dan sesi tidak berubah: `ADMIN_PASSWORD` (>= 12 karakter), `OWNER_PASSWORD` (>= 12), `SESSION_SECRET` (>= 32), kedua sandi berbeda; konfigurasi lemah atau hilang berarti 503 di semua rute dan log hanya memuat nama variabel. Cookie `__Host-overview_session`, HttpOnly, Secure, SameSite=Strict, Path=/, 43200 detik.
- Batas: berkas siklus `.json` paling besar 512 KB (524288 byte), UTF-8 valid; nomor siklus di URL harus cocok `^[1-9][0-9]{0,3}$` (1 sampai 9999); ID dana harus cocok `^[A-Za-z0-9_-]{8,32}$`; jumlah dana 1 sampai 13 angka; paling banyak 200 entri dana; teks paling banyak 200 karakter (`isi` langkah 1000); paling banyak 500 ekor dan 50 baris untuk tiap daftar lain; daftar galat unggahan dipotong pada 10 pesan.
- CSP halaman aplikasi persis: `default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`. Header lain seperti Task 5 lama (`Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`).
- Tidak ada pembuatan project Vercel, Blob store, env var di Vercel, domain, DNS, repo GitHub, push, atau deploy. Itu langkah rilis spec lama bagian 10 dan menunggu konfirmasi pemilik.
- Perintah shell bergaya Git Bash. Berkas yang memuat tanda kutip balik (template literal TypeScript) ditulis dengan alat Write, bukan heredoc Bash.
- TypeScript 7 terpasang: tipe `Uint8Array` untuk API crypto/`c.body` harus `Uint8Array<ArrayBuffer>`; bila `tsc` mengeluh soal tipe sejenis, sesuaikan anotasi tanpa mengubah perilaku dan catat sebagai Ruling.
- Rumus dan tampilan mengikuti `investor/` (versi terbaru). Sebelum Task 1, Task 5, dan Task 8 jalankan `git diff --stat -- investor` dan bandingkan dengan keadaan saat rencana ini ditulis (4 berkas berubah: `hitung.js`, `hitung.test.js`, `index.html`, `siklus.js`, 77 sisipan 7 hapusan). Bila berubah lagi, baca perubahannya, ikuti versi terbaru untuk rumus dan tampilan, dan catat sebagai Ruling.

## Review Focus

1. **Data bermusuhan di berkas siklus dan form dana** (`<script>`, `"><img onerror>` pada pembeli, nama pos, tag, grade, judul dan isi langkah, keterangan dana): harus tampil ter-escape di Ringkasan, rincian, dan admin, dan tidak pernah ada `<script` di halaman mana pun. Tes: Task 5 dan Task 7.
2. **Token sesi diubah** (peran `owner` diganti `admin`, atau tanda tangan/rahasia lain, atau kedaluwarsa): diperlakukan sebagai tanpa sesi. Tes: Task 6.
3. **POST lintas situs** dengan cookie admin yang sah (Origin berbeda atau hilang), dan owner di semua `POST` admin: unggah, hapus siklus, tambah dan hapus dana ditolak dan tidak ada yang berubah. Tes: Task 7.
4. **Berkas unggahan bermusuhan**: kunci `__proto__`/`constructor`, angka tak berhingga atau raksasa, 5 MB, BOM UTF-8 dari Notepad/Excel, bukan UTF-8, JSON berupa larik atau `null`: ditolak dengan pesan atau dinormalisasi, tidak pernah 500. Tes: Task 2 dan Task 7.
5. **Nomor siklus atau ID dana di URL** berisi `../`, desimal, nol di depan, atau di luar pola: 404 tanpa menyentuh penyimpanan. Tes: Task 3, Task 6, dan Task 7.

---

## Struktur berkas (setelah rencana ini)

```
C:\overview
├── README.md                          baru (Task 8)
├── samples/siklus-contoh.json         baru (Task 1); laporan-contoh.html dihapus (Task 6)
├── src/
│   ├── config.ts passwords.ts session.ts rate-limit.ts     tetap
│   ├── siklus/types.ts                Siklus, Ekor, Penjualan, Biaya, Langkah, Dana
│   ├── siklus/hitung.ts               rumus + pemformat (port hitung.js)
│   ├── siklus/validasi.ts             parseSiklus, parseDana
│   ├── store/types.ts                 ObjectBackend, SiklusStore, DanaStore
│   ├── store/siklus-store.ts          createSiklusStore, parseNo, SiklusSudahAdaError
│   ├── store/dana-store.ts            createDanaStore, isValidDanaId, BatasDanaError
│   ├── store/memory-backend.ts file-backend.ts blob-backend.ts   tetap
│   ├── store/from-env.ts              createStoresFromEnv
│   ├── assets/logo.ts                 LOGO_PNG_BASE64
│   ├── views/format.ts layout.ts widgets.ts ringkasan.ts detail.ts admin.ts
│   ├── app.ts bootstrap.ts index.ts dev.ts
└── tests/ (satu berkas per modul; fixtures.ts dan helpers.ts)
```

Dihapus: `src/pages.ts`, `src/store/report-store.ts`, `tests/report-store.test.ts`, lama `tests/admin.test.ts`, `samples/laporan-contoh.html`, `investor/` (setelah snapshot di riwayat).

---

### Task 1: Tipe dan perhitungan (port `hitung.js`)

**Files:**
- Create: `src/siklus/types.ts`, `src/siklus/hitung.ts`, `samples/siklus-contoh.json`
- Test: `tests/hitung.test.ts`

**Interfaces:**
- Produces:
  - Tipe: `Ekor { tag: string; kg: number; loinKg: number; grade: string }`, `Penjualan { nama: string; kg: number; harga: number }`, `Biaya { nama: string; rp: number }`, `Langkah { judul: string; isi?: string; status: 'selesai' | 'berjalan' }`, `Siklus { no: number; produksi: string; kirim?: string; pembeli: string; ekor: Ekor[]; penjualan: Penjualan[]; biaya: Biaya[]; langkah: Langkah[] }`, `Dana { id: string; tanggal: string; jumlah: number; keterangan: string }`.
  - `ringkasSiklus(s: Siklus): RingkasanSiklus` dengan `{ ekor, kgIkan, kgLoin, pendapatan, biaya, laba: number; yield, margin, hppPerKgLoin, hargaRataLoin: number | null }`.
  - `ringkasSemua(daftar: Siklus[]): RingkasanSemua` dengan `{ siklus, ekor, kgIkan, kgLoin, pendapatan, biaya, laba: number; yield, margin: number | null }`.
  - `posisiDana(dana: Dana[], daftar: Siklus[]): PosisiDana | null` dengan `{ diterima, terpakai, kembali, sisa: number; imbal: number | null }`.
  - Pemformat: `rp(n: number): string`, `rpRingkas(n: number): string`, `kg(n: number, d = 2): string`, `persen(x: number | null, d = 1): string`.

- [ ] **Step 1: Periksa `investor/` dan buat data contoh**

```bash
cd /c/overview
git diff --stat -- investor | tail -1
mkdir -p samples
node -e "globalThis.window=globalThis; require('./investor/siklus.js'); require('fs').writeFileSync('samples/siklus-contoh.json', JSON.stringify(window.SIKLUS[0], null, 2) + '\n')"
head -8 samples/siklus-contoh.json
```

Expected: ringkasan diff sesuai Global Constraints (atau catat Ruling bila berubah); `samples/siklus-contoh.json` diawali `{` dan memuat `"no": 1`, `"pembeli": "PT. Sari Nusa Sejati"`.

- [ ] **Step 2: Tipe**

```ts
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
```

- [ ] **Step 3: Tulis tes yang gagal**

```ts
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
```

- [ ] **Step 4: Jalankan, harus gagal**

Run: `npx vitest run tests/hitung.test.ts`
Expected: FAIL, modul `../src/siklus/hitung` tidak ditemukan.

- [ ] **Step 5: Implementasi**

```ts
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
```

- [ ] **Step 6: Jalankan, harus lolos**

Run: `npx vitest run && npx tsc --noEmit`
Expected: semua tes PASS (76 lama + tes baru), `tsc` tanpa galat.

- [ ] **Step 7: Commit**

```bash
git add src/siklus samples/siklus-contoh.json tests/hitung.test.ts
git commit -m "feat: tipe siklus dan perhitungan (port hitung.js)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Validasi unggahan siklus dan isian dana

**Files:**
- Create: `src/siklus/validasi.ts`, `tests/fixtures.ts`
- Test: `tests/validasi.test.ts`

**Interfaces:**
- Consumes: tipe dari Task 1.
- Produces:
  - `parseSiklus(teksJson: string): HasilSiklus` dengan `HasilSiklus = { ok: true; siklus: Siklus } | { ok: false; galat: string[] }`.
  - `parseDana(input: { tanggal?: unknown; jumlah?: unknown; keterangan?: unknown }): HasilDana` dengan `HasilDana = { ok: true; dana: Omit<Dana, 'id'> } | { ok: false; galat: string[] }`.
  - `tanggalSah(d: unknown): d is string`, konstanta `NO_MAKS = 9999`.
  - Fixture tes: `siklusContoh(o?: Partial<Siklus>): Siklus`.

- [ ] **Step 1: Fixture dan tes yang gagal**

```ts
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
```

```ts
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
```

- [ ] **Step 2: Jalankan, harus gagal**

Run: `npx vitest run tests/validasi.test.ts`
Expected: FAIL, modul `../src/siklus/validasi` tidak ditemukan.

- [ ] **Step 3: Implementasi**

```ts
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
```

- [ ] **Step 4: Jalankan, harus lolos**

Run: `npx vitest run && npx tsc --noEmit`
Expected: semua PASS, `tsc` tanpa galat. Bila ada tes yang gagal karena pola pesan, perbaiki kode agar pesannya sesuai pola tes (pola menyatakan perilaku yang diwajibkan), bukan sebaliknya.

- [ ] **Step 5: Commit**

```bash
git add src/siklus/validasi.ts tests/fixtures.ts tests/validasi.test.ts
git commit -m "feat: validasi unggahan siklus dan isian dana" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Penyimpanan siklus dan dana

**Files:**
- Modify: `src/store/types.ts` (tambahkan, jangan hapus `ReportMeta`/`ReportStore` dulu; dihapus di Task 6)
- Create: `src/store/siklus-store.ts`, `src/store/dana-store.ts`
- Test: `tests/siklus-store.test.ts`, `tests/dana-store.test.ts`

**Interfaces:**
- Consumes: `Siklus`, `Dana` (Task 1); `ObjectBackend`, `createMemoryBackend` (rencana lama).
- Produces:
  - `interface SiklusStore { list(): Promise<Siklus[]>; get(no: number): Promise<Siklus | null>; put(siklus: Siklus, opsi: { timpa: boolean }): Promise<'ditambah' | 'diganti'>; remove(no: number): Promise<boolean> }`
  - `interface DanaStore { list(): Promise<Dana[]>; add(input: Omit<Dana, 'id'>): Promise<Dana>; remove(id: string): Promise<boolean> }`
  - `createSiklusStore(backend: ObjectBackend): SiklusStore`; `parseNo(teks: string): number | null`; `class SiklusSudahAdaError extends Error { no: number }`.
  - `createDanaStore(backend: ObjectBackend, opsi?: { newId?: () => string }): DanaStore`; `isValidDanaId(id: string): boolean`; `DANA_MAKS = 200`; `class BatasDanaError extends Error`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/siklus-store.test.ts
import { describe, expect, it } from 'vitest';
import { createMemoryBackend } from '../src/store/memory-backend';
import { createSiklusStore, parseNo, SiklusSudahAdaError } from '../src/store/siklus-store';
import type { ObjectBackend } from '../src/store/types';
import { siklusContoh } from './fixtures';

describe('SiklusStore', () => {
  it('kosong pada awalnya dan mengurutkan menurut nomor naik', async () => {
    const store = createSiklusStore(createMemoryBackend());
    expect(await store.list()).toEqual([]);
    await store.put(siklusContoh({ no: 3 }), { timpa: false });
    await store.put(siklusContoh({ no: 1 }), { timpa: false });
    await store.put(siklusContoh({ no: 2 }), { timpa: false });
    expect((await store.list()).map((s) => s.no)).toEqual([1, 2, 3]);
    expect((await store.get(2))?.no).toBe(2);
    expect(await store.get(4)).toBeNull();
  });

  it('menolak nomor kembar tanpa timpa dan tidak mengubah apa pun', async () => {
    const store = createSiklusStore(createMemoryBackend());
    expect(await store.put(siklusContoh({ pembeli: 'Lama' }), { timpa: false })).toBe('ditambah');
    await expect(store.put(siklusContoh({ pembeli: 'Baru' }), { timpa: false })).rejects.toBeInstanceOf(SiklusSudahAdaError);
    expect((await store.get(1))?.pembeli).toBe('Lama');
  });

  it('mengganti seluruh siklus bila timpa', async () => {
    const store = createSiklusStore(createMemoryBackend());
    await store.put(siklusContoh({ pembeli: 'Lama' }), { timpa: false });
    expect(await store.put(siklusContoh({ pembeli: 'Baru', ekor: [] }), { timpa: true })).toBe('diganti');
    const daftar = await store.list();
    expect(daftar).toHaveLength(1);
    expect(daftar[0]).toMatchObject({ pembeli: 'Baru', ekor: [] });
  });

  it('menghapus siklus dan menolak nomor yang tidak ada', async () => {
    const store = createSiklusStore(createMemoryBackend());
    await store.put(siklusContoh(), { timpa: false });
    expect(await store.remove(1)).toBe(true);
    expect(await store.list()).toEqual([]);
    expect(await store.remove(1)).toBe(false);
  });

  it.each([0, -1, 10000, 1.5, Number.NaN])('nomor %s tidak valid tidak menyentuh backend', async (no) => {
    const dibaca: string[] = [];
    const spy: ObjectBackend = {
      read: async (path) => (dibaca.push(path), null),
      write: async () => {},
      remove: async () => {},
    };
    const store = createSiklusStore(spy);
    expect(await store.get(no)).toBeNull();
    expect(await store.remove(no)).toBe(false);
    expect(dibaca).toEqual([]);
  });

  it('melaporkan dokumen rusak sebagai galat, bukan daftar kosong', async () => {
    const backend = createMemoryBackend();
    await backend.write('data/siklus.json', '{bukan json');
    await expect(createSiklusStore(backend).list()).rejects.toThrow();
    await backend.write('data/siklus.json', '{"a":1}');
    await expect(createSiklusStore(backend).list()).rejects.toThrow('Dokumen siklus rusak');
  });

  it('kegagalan tulis tidak mengubah isi yang sudah ada', async () => {
    const backend = createMemoryBackend();
    const awal = createSiklusStore(backend);
    await awal.put(siklusContoh({ pembeli: 'Lama' }), { timpa: false });
    const gagal = createSiklusStore({ ...backend, write: async () => { throw new Error('Blob gagal'); } });
    await expect(gagal.put(siklusContoh({ pembeli: 'Baru' }), { timpa: true })).rejects.toThrow('Blob gagal');
    expect((await awal.get(1))?.pembeli).toBe('Lama');
  });
});

describe('parseNo', () => {
  it.each(['1', '9', '10', '9999'])('menerima %s', (teks) => {
    expect(parseNo(teks)).toBe(Number(teks));
  });
  it.each(['0', '01', '10000', '-1', '1.5', 'abc', '', '..', '../1', '1 ', '١'])('menolak %j', (teks) => {
    expect(parseNo(teks)).toBeNull();
  });
});
```

```ts
// tests/dana-store.test.ts
import { describe, expect, it } from 'vitest';
import { BatasDanaError, createDanaStore, DANA_MAKS, isValidDanaId } from '../src/store/dana-store';
import { createMemoryBackend } from '../src/store/memory-backend';
import type { ObjectBackend } from '../src/store/types';

const buat = () => {
  const backend = createMemoryBackend();
  let n = 0;
  const store = createDanaStore(backend, { newId: () => `dana-${String(++n).padStart(4, '0')}` });
  return { backend, store };
};
const isian = (tanggal: string, jumlah = 1000, keterangan = 'Uji') => ({ tanggal, jumlah, keterangan });

describe('DanaStore', () => {
  it('menambah dana dengan ID baru dan mengurutkan menurut tanggal naik', async () => {
    const { store } = buat();
    const b = await store.add(isian('2026-10-07'));
    const a = await store.add(isian('2026-10-05'));
    expect(a).toEqual({ id: 'dana-0002', tanggal: '2026-10-05', jumlah: 1000, keterangan: 'Uji' });
    expect(b.id).toBe('dana-0001');
    expect((await store.list()).map((d) => d.tanggal)).toEqual(['2026-10-05', '2026-10-07']);
  });

  it('tanggal sama diurutkan menurut ID', async () => {
    const { store } = buat();
    await store.add(isian('2026-10-05', 1));
    await store.add(isian('2026-10-05', 2));
    expect((await store.list()).map((d) => d.id)).toEqual(['dana-0001', 'dana-0002']);
  });

  it('menghapus dana dan menolak ID yang tidak ada', async () => {
    const { store } = buat();
    const dana = await store.add(isian('2026-10-05'));
    expect(await store.remove(dana.id)).toBe(true);
    expect(await store.list()).toEqual([]);
    expect(await store.remove(dana.id)).toBe(false);
  });

  it.each(['../index', '..%2Findex', 'a/b', 'pendek', 'x'.repeat(33), 'spasi di sini', ''])(
    'ID %j tidak valid tidak menyentuh backend',
    async (id) => {
      const dibaca: string[] = [];
      const spy: ObjectBackend = {
        read: async (path) => (dibaca.push(path), null),
        write: async () => {},
        remove: async () => {},
      };
      expect(isValidDanaId(id)).toBe(false);
      expect(await createDanaStore(spy).remove(id)).toBe(false);
      expect(dibaca).toEqual([]);
    },
  );

  it('menolak entri ke-201 dan tidak mengubah apa pun', async () => {
    const { store, backend } = buat();
    const awal = Array.from({ length: DANA_MAKS }, (_v, i) => ({ id: `dana-${String(i).padStart(4, '0')}`, tanggal: '2026-10-05', jumlah: 1, keterangan: '' }));
    await backend.write('data/dana.json', JSON.stringify(awal));
    await expect(store.add(isian('2026-10-06'))).rejects.toBeInstanceOf(BatasDanaError);
    expect(await store.list()).toHaveLength(DANA_MAKS);
  });

  it('melaporkan dokumen rusak sebagai galat', async () => {
    const backend = createMemoryBackend();
    await backend.write('data/dana.json', '{"a":1}');
    await expect(createDanaStore(backend).list()).rejects.toThrow('Dokumen dana rusak');
    await backend.write('data/dana.json', 'bukan json');
    await expect(createDanaStore(backend).list()).rejects.toThrow();
  });

  it('membuat ID acak yang lolos pola bila newId tidak diberikan', async () => {
    const store = createDanaStore(createMemoryBackend());
    const dana = await store.add(isian('2026-10-05'));
    expect(isValidDanaId(dana.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan, harus gagal**

Run: `npx vitest run tests/siklus-store.test.ts tests/dana-store.test.ts`
Expected: FAIL, modul `siklus-store` dan `dana-store` tidak ditemukan.

- [ ] **Step 3: Implementasi**

Ganti isi `src/store/types.ts` dengan (tipe laporan lama dipertahankan sementara agar Task 3–5 tetap hijau; dihapus di Task 6):

```ts
// src/store/types.ts
import type { Dana, Siklus } from '../siklus/types';

export interface ObjectBackend {
  read(path: string): Promise<string | null>;
  write(path: string, body: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface SiklusStore {
  list(): Promise<Siklus[]>;
  get(no: number): Promise<Siklus | null>;
  put(siklus: Siklus, opsi: { timpa: boolean }): Promise<'ditambah' | 'diganti'>;
  remove(no: number): Promise<boolean>;
}

export interface DanaStore {
  list(): Promise<Dana[]>;
  add(input: Omit<Dana, 'id'>): Promise<Dana>;
  remove(id: string): Promise<boolean>;
}

// Dihapus di Task 6 bersama report-store.
export interface ReportMeta {
  id: string;
  title: string;
  uploadedAt: string;
  size: number;
}

export interface ReportStore {
  list(): Promise<ReportMeta[]>;
  get(id: string): Promise<{ meta: ReportMeta; html: string } | null>;
  add(input: { title: string; html: string }): Promise<ReportMeta>;
  remove(id: string): Promise<boolean>;
}
```

```ts
// src/store/siklus-store.ts
import type { Siklus } from '../siklus/types';
import type { ObjectBackend, SiklusStore } from './types';

const PATH = 'data/siklus.json';
const NO_POLA = /^[1-9][0-9]{0,3}$/;
const NO_MAKS = 9999;

export const parseNo = (teks: string): number | null => (NO_POLA.test(teks) ? Number(teks) : null);
const nomorSah = (no: number) => Number.isInteger(no) && no >= 1 && no <= NO_MAKS;
const urut = (daftar: Siklus[]) => [...daftar].sort((a, b) => a.no - b.no);

export class SiklusSudahAdaError extends Error {
  constructor(readonly no: number) {
    super(`Siklus ${no} sudah ada`);
    this.name = 'SiklusSudahAdaError';
  }
}

// Semua siklus satu dokumen: satu penulisan per operasi, tidak ada keadaan setengah jadi.
// Dua admin yang menulis serentak bisa saling menimpa (batas yang diterima, lihat spec bagian 12).
export function createSiklusStore(backend: ObjectBackend): SiklusStore {
  const baca = async (): Promise<Siklus[]> => {
    const mentah = await backend.read(PATH);
    if (mentah === null) return [];
    const data: unknown = JSON.parse(mentah);
    if (!Array.isArray(data)) throw new Error('Dokumen siklus rusak');
    return urut(data as Siklus[]);
  };
  const tulis = (daftar: Siklus[]) => backend.write(PATH, JSON.stringify(urut(daftar)));

  return {
    list: baca,

    async get(no) {
      if (!nomorSah(no)) return null;
      return (await baca()).find((s) => s.no === no) ?? null;
    },

    async put(siklus, { timpa }) {
      const daftar = await baca();
      const ada = daftar.some((s) => s.no === siklus.no);
      if (ada && !timpa) throw new SiklusSudahAdaError(siklus.no);
      await tulis([...daftar.filter((s) => s.no !== siklus.no), siklus]);
      return ada ? 'diganti' : 'ditambah';
    },

    async remove(no) {
      if (!nomorSah(no)) return false;
      const daftar = await baca();
      if (!daftar.some((s) => s.no === no)) return false;
      await tulis(daftar.filter((s) => s.no !== no));
      return true;
    },
  };
}
```

```ts
// src/store/dana-store.ts
import type { Dana } from '../siklus/types';
import type { DanaStore, ObjectBackend } from './types';

const PATH = 'data/dana.json';
const ID_POLA = /^[A-Za-z0-9_-]{8,32}$/;
export const DANA_MAKS = 200;

export const isValidDanaId = (id: string) => ID_POLA.test(id);
const urut = (daftar: Dana[]) =>
  [...daftar].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id.localeCompare(b.id));

export class BatasDanaError extends Error {
  constructor() {
    super(`Dana sudah mencapai batas ${DANA_MAKS} entri.`);
    this.name = 'BatasDanaError';
  }
}

interface Opsi {
  newId?: () => string;
}

export function createDanaStore(backend: ObjectBackend, opsi: Opsi = {}): DanaStore {
  const newId = opsi.newId ?? (() => crypto.randomUUID().replaceAll('-', '').slice(0, 12));

  const baca = async (): Promise<Dana[]> => {
    const mentah = await backend.read(PATH);
    if (mentah === null) return [];
    const data: unknown = JSON.parse(mentah);
    if (!Array.isArray(data)) throw new Error('Dokumen dana rusak');
    return urut(data as Dana[]);
  };
  const tulis = (daftar: Dana[]) => backend.write(PATH, JSON.stringify(urut(daftar)));

  return {
    list: baca,

    async add(input) {
      const daftar = await baca();
      if (daftar.length >= DANA_MAKS) throw new BatasDanaError();
      const dana: Dana = { id: newId(), ...input };
      await tulis([...daftar, dana]);
      return dana;
    },

    async remove(id) {
      if (!isValidDanaId(id)) return false;
      const daftar = await baca();
      if (!daftar.some((d) => d.id === id)) return false;
      await tulis(daftar.filter((d) => d.id !== id));
      return true;
    },
  };
}
```

- [ ] **Step 4: Jalankan, harus lolos**

Run: `npx vitest run && npx tsc --noEmit`
Expected: semua PASS, `tsc` tanpa galat.

- [ ] **Step 5: Commit**

```bash
git add src/store tests/siklus-store.test.ts tests/dana-store.test.ts
git commit -m "feat: penyimpanan siklus dan dana di atas backend objek" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Kerangka halaman, widget, dan logo

**Files:**
- Create: `src/assets/logo.ts` (dibuat oleh skrip), `src/views/format.ts`, `src/views/layout.ts`, `src/views/widgets.ts`
- Test: `tests/logo.test.ts`, `tests/views-layout.test.ts`

**Interfaces:**
- Consumes: `Role` (`src/session.ts`), `Siklus` (Task 1).
- Produces:
  - `LOGO_PNG_BASE64: string`
  - `tgl(d: string | undefined): string` (mis. `'2026-10-03'` menjadi `'3 Oktober 2026'`, `undefined` menjadi `'—'`)
  - `interface NavItem { href: string; teks: string; aktif: boolean }`; `navSiklus(daftar: Siklus[], aktif: 'ringkasan' | 'admin' | number): NavItem[]`
  - `shell(input: { judul: string; heading: string; label?: string; lead?: string; nav?: NavItem[]; peran?: Role | null; isi: unknown; polos?: boolean })` mengembalikan hasil `html` Hono (string HTML penuh)
  - `messagePage(judul: string, teks: string)`, `loginPage(galat?: string)`
  - `kpi(items: { k: string; v: string; s: string; kelas?: 'naik' | 'turun' }[])`, `batang(items: { label: string; v: number | null }[], opsi: { format: (v: number | null) => string; target?: number })`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/logo.test.ts
import { expect, it } from 'vitest';
import { LOGO_PNG_BASE64 } from '../src/assets/logo';

it('logo adalah berkas PNG yang utuh', () => {
  const bytes = Buffer.from(LOGO_PNG_BASE64, 'base64');
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(bytes.length).toBeGreaterThan(1000);
});
```

```ts
// tests/views-layout.test.ts
import { describe, expect, it } from 'vitest';
import { tgl } from '../src/views/format';
import { loginPage, messagePage, navSiklus, shell } from '../src/views/layout';
import { batang, kpi } from '../src/views/widgets';
import { siklusContoh } from './fixtures';

const teks = async (x: unknown) => String(await x);

describe('tgl', () => {
  it('memformat tanggal Indonesia dan menangani kosong', () => {
    expect(tgl('2026-10-03')).toBe('3 Oktober 2026');
    expect(tgl(undefined)).toBe('—');
    expect(tgl('')).toBe('—');
  });
});

describe('shell', () => {
  const dasar = { judul: 'Uji', heading: 'Judul', isi: '<p>isi</p>' };

  it('memuat logo, meta noindex, dan gaya tanpa meng-escape tanda kutip CSS', async () => {
    const h = await teks(shell(dasar));
    expect(h).toContain('<img src="/aset/logo-putih.png"');
    expect(h).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(h).toContain('<title>Uji · Overview</title>');
    expect(h).toMatch(/<style>[^<]*"Segoe UI"/);
    expect(h).not.toMatch(/<script/i);
  });

  it('tanpa peran tidak ada tombol Keluar maupun Kelola', async () => {
    const h = await teks(shell(dasar));
    expect(h).not.toContain('action="/logout"');
    expect(h).not.toContain('/admin');
  });

  it('owner melihat Keluar tetapi tidak ada tautan admin', async () => {
    const h = await teks(shell({ ...dasar, peran: 'owner' }));
    expect(h).toContain('action="/logout"');
    expect(h).not.toContain('/admin');
  });

  it('admin melihat Kelola dan Keluar', async () => {
    const h = await teks(shell({ ...dasar, peran: 'admin' }));
    expect(h).toContain('href="/admin"');
    expect(h).toContain('action="/logout"');
  });

  it('meng-escape judul, heading, label, lead, dan teks navigasi', async () => {
    const jahat = '<b>x</b>';
    const h = await teks(
      shell({ judul: jahat, heading: jahat, label: jahat, lead: jahat, nav: [{ href: '/', teks: jahat, aktif: true }], isi: '' }),
    );
    expect(h).not.toContain('<b>x</b>');
    expect(h).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('menandai navigasi aktif dengan aria-current', async () => {
    const nav = navSiklus([siklusContoh({ no: 1 }), siklusContoh({ no: 2 })], 2);
    expect(nav.map((n) => [n.teks, n.aktif])).toEqual([['Ringkasan', false], ['Siklus 1', false], ['Siklus 2', true]]);
    expect(nav[2].href).toBe('/siklus/2');
    const h = await teks(shell({ ...dasar, nav }));
    expect(h.match(/aria-current="page"/g)).toHaveLength(1);
  });
});

describe('halaman pesan dan login', () => {
  it('halaman pesan meng-escape isi', async () => {
    const h = await teks(messagePage('Ditolak', '<script>x</script>'));
    expect(h).toContain('Ditolak');
    expect(h).not.toMatch(/<script/i);
  });

  it('login memuat kolom sandi dan meng-escape galat', async () => {
    const h = await teks(loginPage('<i>salah</i>'));
    expect(h).toContain('type="password"');
    expect(h).toContain('action="/login"');
    expect(h).toContain('&lt;i&gt;salah&lt;/i&gt;');
    expect(await teks(loginPage())).not.toContain('role="alert"');
  });
});

describe('widget', () => {
  it('kpi merender label, nilai, dan kelas', async () => {
    const h = await teks(kpi([{ k: 'Laba', v: 'Rp 1', s: 'Margin 1 %', kelas: 'naik' }, { k: '<k>', v: '2', s: '3' }]));
    expect(h).toContain('class="v naik"');
    expect(h).toContain('&lt;k&gt;');
  });

  it('batang membatasi lebar 0 sampai 100, menangani negatif dan null, tanpa NaN', async () => {
    const h = await teks(
      batang(
        [{ label: 'A', v: -0.2 }, { label: 'B', v: 0.5 }, { label: 'C', v: null }, { label: 'D', v: 0 }],
        { format: (v) => (v == null ? '—' : String(v)), target: 0.6 },
      ),
    );
    expect(h).not.toMatch(/NaN|Infinity/);
    for (const [, nilai] of h.matchAll(/(?:width|left):([0-9.]+)%/g)) {
      expect(Number(nilai)).toBeGreaterThanOrEqual(0);
      expect(Number(nilai)).toBeLessThanOrEqual(100);
    }
    expect(h).toContain('isi neg');
    expect(h).toContain('class="target"');
  });

  it('batang dengan semua nilai nol tidak membagi nol', async () => {
    const h = await teks(batang([{ label: 'A', v: 0 }], { format: String }));
    expect(h).not.toMatch(/NaN|Infinity/);
  });
});
```

- [ ] **Step 2: Jalankan, harus gagal**

Run: `npx vitest run tests/logo.test.ts tests/views-layout.test.ts`
Expected: FAIL, modul `../src/assets/logo` dan `../src/views/*` tidak ditemukan.

- [ ] **Step 3: Buat `logo.ts` dari logo pemilik**

```bash
cd /c/overview
mkdir -p src/assets
node -e "const fs=require('fs');const b=fs.readFileSync('investor/logo-putih.png').toString('base64');fs.writeFileSync('src/assets/logo.ts','// Dibuat dari investor/logo-putih.png (logo perusahaan, tidak rahasia).\nexport const LOGO_PNG_BASE64 =\n  \''+b+'\';\n')"
head -c 200 src/assets/logo.ts
```

Expected: berkas diawali komentar dan `export const LOGO_PNG_BASE64 =` diikuti string yang dimulai `iVBORw0KGgo` (tanda tangan PNG dalam base64).

- [ ] **Step 4: Implementasi format, layout, dan widget**

```ts
// src/views/format.ts
// Tanggal YYYY-MM-DD ditafsirkan sebagai tanggal kalender WIB.
export const tgl = (d: string | undefined) =>
  d
    ? new Date(`${d}T00:00:00+07:00`).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      })
    : '—';
```

```ts
// src/views/layout.ts
import { html, raw } from 'hono/html';
import type { Role } from '../session';
import type { Siklus } from '../siklus/types';

// Gaya diambil dari investor/index.html; font sistem (tanpa Google Fonts) karena CSP melarang sumber luar.
const styles = `
:root{
  --bg:#f5f8fa;--surface:#fff;--ink:#0f2433;--muted:#5a6f7d;--line:#d9e3ea;
  --laut:#0a6b9e;--laut-muda:#e3f0f7;--naik:#1f7a4d;--turun:#b4442f;--turun-muda:#f8e7e3;
  --sans:system-ui,-apple-system,"Segoe UI",sans-serif;
  --serif:Georgia,"Times New Roman",serif;--mono:ui-monospace,Menlo,Consolas,monospace;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#08151e;--surface:#0f2130;--ink:#e4edf3;--muted:#93a8b6;--line:#20384a;
  --laut:#4fb0e3;--laut-muda:#123047;--naik:#5cc48f;--turun:#ec8a74;--turun-muda:#3a1e19;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 var(--sans)}
a{color:var(--laut)}
.pita{background:linear-gradient(135deg,#06324d,#0a6b9e);color:#fff;padding-inline:16px}
.pita-isi{max-width:960px;margin:0 auto;padding-block:24px 44px}
.pita img{height:40px;display:block}
.atas{display:flex;justify-content:space-between;align-items:center;gap:12px}
.aksi{display:flex;gap:8px;align-items:center}
.aksi form{margin:0}
.aksi a,.aksi button{color:#fff;background:none;font:500 13px/1 var(--mono);padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.35);text-decoration:none;cursor:pointer}
.pita nav{display:flex;flex-wrap:wrap;gap:6px;margin-top:24px}
.pita nav a{color:#fff;text-decoration:none;font:500 13px/1 var(--mono);padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.35)}
.pita nav a[aria-current="page"]{background:#fff;color:#06324d;border-color:#fff}
.label{font:500 12px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;opacity:.8;margin:28px 0 10px}
h1{font:500 clamp(28px,5vw,40px)/1.15 var(--serif);margin:0;text-wrap:balance}
.pita p.lead{max-width:62ch;margin:12px 0 0;opacity:.88}
main{max-width:960px;margin:0 auto;padding-inline:16px;padding-block:0 64px;display:flex;flex-direction:column;gap:48px}
main.polos{padding-block-start:32px}
section{display:flex;flex-direction:column;gap:16px;min-width:0}
h2{font:600 21px/1.3 var(--sans);margin:0;text-wrap:balance}
.eyebrow{font:500 12px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--laut);margin:0}
.muted{color:var(--muted)}
.kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-top:-28px}
.kpi div{background:var(--surface);padding:16px 18px;display:flex;flex-direction:column;gap:4px;min-width:0}
.kpi .k,.kpi .s{font-size:13px;color:var(--muted)}
.kpi .v{font:500 23px/1.2 var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.v.naik{color:var(--naik)}.v.turun,.turun{color:var(--turun)}
@media (max-width:760px){.kpi{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:420px){.kpi{grid-template-columns:minmax(0,1fr)}}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px;min-width:0}
.gulir{overflow-x:auto;position:relative}
table{width:100%;border-collapse:collapse;font-size:14px}
th{font-weight:500;color:var(--muted);text-align:left;font-size:13px;border-bottom:1px solid var(--line);padding:8px 10px;white-space:nowrap}
td{padding:9px 10px;border-bottom:1px solid var(--line)}
.r{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
tr.total td{font-weight:600;border-bottom:none;border-top:1.5px solid var(--ink)}
.hbar{display:flex;flex-direction:column;gap:8px}
.hbar .row{display:grid;grid-template-columns:90px minmax(0,1fr) 90px;gap:10px;align-items:center;font-size:14px}
.hbar .trak{position:relative;height:16px;background:var(--laut-muda);border-radius:3px}
.hbar .isi{position:absolute;top:0;bottom:0;background:var(--laut);border-radius:3px}
.hbar .isi.neg{background:var(--turun)}
.hbar .nol{position:absolute;top:-3px;bottom:-3px;border-left:1.5px solid var(--muted)}
.hbar .target{position:absolute;top:-3px;bottom:-3px;border-left:1.5px dashed var(--turun)}
.dua{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
@media (max-width:760px){.dua{grid-template-columns:minmax(0,1fr)}}
.yield{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(6px,1fr);gap:4px;align-items:end;height:190px;position:relative;padding-top:18px;min-width:max(100%,var(--lebar))}
.yield .b{background:var(--laut);border-radius:3px 3px 0 0;position:relative}
.yield .b.c{background:var(--muted)}
.yield .b span{position:absolute;top:-17px;left:50%;transform:translateX(-50%);font:500 11px/1 var(--mono);white-space:nowrap}
.yield .garis{position:absolute;left:0;right:0;border-top:1.5px dashed var(--turun);z-index:1;pointer-events:none}
.yx{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(6px,1fr);gap:4px;margin-top:6px;font:11px/1.3 var(--mono);color:var(--muted);text-align:center;min-width:max(100%,var(--lebar))}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--muted);margin-top:10px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}
.biaya .row{grid-template-columns:130px minmax(0,1fr) 160px}
@media (max-width:520px){.hbar .row,.biaya .row{grid-template-columns:minmax(0,1fr) auto}.hbar .trak{grid-column:1/-1;order:3}}
.langkah{list-style:none;margin:0;padding:0}
.langkah li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 16px;padding:12px 0;border-bottom:1px solid var(--line)}
.langkah li:last-child{border-bottom:none}
.langkah p{margin:0;color:var(--muted);font-size:14px}
.chip{grid-row:1;grid-column:2;font:500 11px/1 var(--mono);text-transform:uppercase;letter-spacing:.06em;padding:6px 8px;border-radius:999px;align-self:start}
.chip.selesai{background:var(--laut-muda);color:var(--laut)}.chip.berjalan{background:var(--turun-muda);color:var(--turun)}
.antar{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:14px}
.galat{background:var(--turun-muda);color:var(--turun);border-radius:10px;padding:16px 18px;font-weight:500}
.galat ul{margin:0;padding-left:18px}
.sukses{background:var(--laut-muda);color:var(--laut);border-radius:10px;padding:12px 16px;font-weight:500;margin:0}
.dana{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.dana div{display:flex;flex-direction:column;gap:4px;min-width:0}
.dana .k{font-size:13px;color:var(--muted)}.dana .v{font:500 20px/1.2 var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
@media (max-width:760px){.dana{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:420px){.dana{grid-template-columns:minmax(0,1fr)}}
.pakai{height:12px;background:var(--laut-muda);border-radius:3px;overflow:hidden;margin-top:16px}.pakai div{height:100%;background:var(--laut)}
.kepala-bagian{display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap}
.tombol{display:inline-block;background:var(--laut);color:#fff;text-decoration:none;font:500 14px/1 var(--sans);padding:11px 16px;border-radius:8px;border:0;cursor:pointer}
.tombol.bahaya{background:var(--turun)}
form.isian{display:grid;gap:12px;max-width:520px}
label{display:grid;gap:4px;font-weight:500}
label.cek{display:flex;gap:8px;align-items:center;font-weight:400}
input[type=text],input[type=password],input[type=date],input[type=file]{font:inherit;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}
`;

export interface NavItem {
  href: string;
  teks: string;
  aktif: boolean;
}

export const navSiklus = (daftar: Siklus[], aktif: 'ringkasan' | 'admin' | number): NavItem[] => [
  { href: '/', teks: 'Ringkasan', aktif: aktif === 'ringkasan' },
  ...daftar.map((s) => ({ href: `/siklus/${s.no}`, teks: `Siklus ${s.no}`, aktif: aktif === s.no })),
];

export interface ShellInput {
  judul: string;
  heading: string;
  label?: string;
  lead?: string;
  nav?: NavItem[];
  peran?: Role | null;
  isi: unknown;
  polos?: boolean;
}

export const shell = ({ judul, heading, label, lead, nav, peran, isi, polos }: ShellInput) => html`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${judul} · Overview</title>
<style>${raw(styles)}</style>
</head>
<body>
<header class="pita"><div class="pita-isi">
  <div class="atas">
    <a href="/"><img src="/aset/logo-putih.png" alt="PT. Katalis Lintas Global"></a>
    <div class="aksi">${peran === 'admin' ? html`<a href="/admin">Kelola</a>` : ''}${peran ? html`<form method="post" action="/logout"><button type="submit">Keluar</button></form>` : ''}</div>
  </div>
  ${nav ? html`<nav aria-label="Siklus">${nav.map((n) => html`<a href="${n.href}"${n.aktif ? raw(' aria-current="page"') : ''}>${n.teks}</a>`)}</nav>` : ''}
  ${label ? html`<p class="label">${label}</p>` : ''}
  <h1>${heading}</h1>
  ${lead ? html`<p class="lead">${lead}</p>` : ''}
</div></header>
<main${polos ? raw(' class="polos"') : ''}>${isi}</main>
</body>
</html>`;

export const messagePage = (judul: string, teks: string) =>
  shell({ judul, heading: judul, isi: html`<p>${teks}</p><p><a href="/">Kembali</a></p>`, polos: true });

export const loginPage = (galat?: string) =>
  shell({
    judul: 'Masuk',
    heading: 'Masuk',
    polos: true,
    isi: html`
      ${galat ? html`<p class="galat" role="alert">${galat}</p>` : ''}
      <form class="isian" method="post" action="/login">
        <label>Sandi
          <input type="password" name="password" autocomplete="current-password" maxlength="200" required autofocus>
        </label>
        <button class="tombol" type="submit">Masuk</button>
      </form>`,
  });
```

```ts
// src/views/widgets.ts
import { html } from 'hono/html';

export interface KpiItem {
  k: string;
  v: string;
  s: string;
  kelas?: 'naik' | 'turun';
}

export const kpi = (items: KpiItem[]) =>
  html`<div class="kpi">${items.map(
    (i) => html`<div><span class="k">${i.k}</span><span class="v ${i.kelas ?? ''}">${i.v}</span><span class="s">${i.s}</span></div>`,
  )}</div>`;

export interface BatangItem {
  label: string;
  v: number | null;
}

const batasi = (n: number) => Number(Math.min(100, Math.max(0, n)).toFixed(2));

// Batang mendatar bertanda: nol selalu tergambar, nilai negatif ke kiri. Semua persentase dibatasi 0 sampai 100.
export function batang(items: BatangItem[], opsi: { format: (v: number | null) => string; target?: number }) {
  const nilai = items.map((i) => i.v ?? 0).concat(opsi.target ?? 0, 0);
  const lo = Math.min(...nilai);
  const hi = Math.max(...nilai);
  const rentang = hi - lo || 1;
  const pos = (v: number) => batasi(((v - lo) / rentang) * 100);

  return html`<div class="hbar">${items.map((i) => {
    const v = i.v;
    const isi =
      v == null
        ? ''
        : html`<div class="isi ${v < 0 ? 'neg' : ''}" style="left:${pos(Math.min(0, v))}%;width:${batasi(Math.abs(pos(v) - pos(0)))}%"></div>`;
    const target = opsi.target != null ? html`<div class="target" style="left:${pos(opsi.target)}%"></div>` : '';
    return html`<div class="row"><span>${i.label}</span><div class="trak">${isi}<div class="nol" style="left:${pos(0)}%"></div>${target}</div><span class="r">${opsi.format(v)}</span></div>`;
  })}</div>`;
}
```

- [ ] **Step 5: Jalankan, harus lolos**

Run: `npx vitest run && npx tsc --noEmit`
Expected: semua PASS. Bila `tsc` mengeluh tentang tipe `html` Hono (mis. nilai `unknown`), sesuaikan tipe parameter tanpa mengubah perilaku dan catat Ruling.

- [ ] **Step 6: Commit**

```bash
git add src/assets src/views tests/logo.test.ts tests/views-layout.test.ts
git commit -m "feat: kerangka halaman, widget, dan logo" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Halaman Ringkasan, rincian siklus, dan admin

**Files:**
- Create: `src/views/ringkasan.ts`, `src/views/detail.ts`, `src/views/admin.ts`
- Test: `tests/views.test.ts`

**Interfaces:**
- Consumes: semua dari Task 1 dan Task 4.
- Produces:
  - `ringkasanPage(input: { daftar: Siklus[]; dana: Dana[]; peran: Role })`
  - `detailPage(input: { daftar: Siklus[]; siklus: Siklus; peran: Role })`
  - `adminPage(input: { daftar: Siklus[]; dana: Dana[]; pesan?: string; galatSiklus?: string[]; galatDana?: string[] })` (selalu untuk peran admin)
  - Semua mengembalikan hasil `html` Hono.

- [ ] **Step 1: Periksa `investor/index.html` terbaru**

Run: `git diff --stat -- investor | tail -1`
Expected: sesuai Global Constraints. Bila berubah, baca perubahannya dan ikuti versi terbaru untuk teks dan struktur halaman; catat Ruling.

- [ ] **Step 2: Tulis tes yang gagal**

```ts
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
```

- [ ] **Step 3: Jalankan, harus gagal**

Run: `npx vitest run tests/views.test.ts`
Expected: FAIL, modul `../src/views/ringkasan`, `detail`, `admin` tidak ditemukan.

- [ ] **Step 4: Implementasi Ringkasan**

```ts
// src/views/ringkasan.ts
import { html } from 'hono/html';
import type { Role } from '../session';
import { kg, persen, posisiDana, ringkasSemua, ringkasSiklus, rp, rpRingkas } from '../siklus/hitung';
import type { Dana, Siklus } from '../siklus/types';
import { tgl } from './format';
import { navSiklus, shell } from './layout';
import { batang, kpi } from './widgets';

const kelasLaba = (n: number): 'naik' | 'turun' => (n < 0 ? 'turun' : 'naik');

function bagianDana(dana: Dana[], daftar: Siklus[]) {
  const p = posisiDana(dana, daftar);
  if (!p) return '';
  const porsi = Math.min(1, Math.max(0, p.terpakai / p.diterima));
  const lebar = Number((porsi * 100).toFixed(2));
  const rincian =
    dana.length > 1
      ? html`<div class="gulir" style="margin-top:14px"><table><thead><tr><th>Tanggal</th><th>Keterangan</th><th class="r">Jumlah</th></tr></thead><tbody>${dana.map(
          (x) => html`<tr><td>${tgl(x.tanggal)}</td><td>${x.keterangan}</td><td class="r">${rp(x.jumlah)}</td></tr>`,
        )}</tbody></table></div>`
      : html`<p class="muted" style="margin:6px 0 0;font-size:13px">Diterima ${tgl(dana[0].tanggal)}${dana[0].keterangan ? html` · ${dana[0].keterangan}` : ''}.</p>`;

  return html`<section><p class="eyebrow">Dana investor</p><h2>Sisa dana ${rp(p.sisa)} dari ${rp(p.diterima)} yang diterima</h2>
    <div class="panel">
      <div class="dana">
        <div><span class="k">Dana diterima</span><span class="v">${rpRingkas(p.diterima)}</span></div>
        <div><span class="k">Terpakai untuk biaya produksi</span><span class="v">${rpRingkas(p.terpakai)}</span></div>
        <div><span class="k">Kembali dari penjualan</span><span class="v">${rpRingkas(p.kembali)}</span></div>
        <div><span class="k">Imbal hasil terhadap dana</span><span class="v ${kelasLaba(p.sisa - p.diterima)}">${persen(p.imbal, 2)}</span></div>
      </div>
      <div class="pakai" title="Biaya produksi ${persen(porsi)} dari dana"><div style="width:${lebar}%"></div></div>
      <p class="muted" style="margin:8px 0 0;font-size:13px">Biaya produksi semua siklus = ${persen(porsi)} dari dana yang diterima.</p>
      ${rincian}
      <p class="muted" style="margin:12px 0 0;font-size:13px">Sisa dana dihitung dengan anggapan seluruh penjualan sudah dibayar dan seluruh biaya sudah dilunasi; biaya di luar siklus produksi (gaji kantor, sewa, aset) belum termasuk.</p>
    </div>
  </section>`;
}

export function ringkasanPage({ daftar, dana, peran }: { daftar: Siklus[]; dana: Dana[]; peran: Role }) {
  const t = ringkasSemua(daftar);
  const adaSiklus = t.siklus > 0;
  const tombol = peran === 'admin' ? html`<a class="tombol" href="/admin">Tambah siklus</a>` : '';
  const baris = daftar.map((s) => ({ s, r: ringkasSiklus(s) }));

  const isi = adaSiklus
    ? html`${kpi([
        { k: 'Ikan utuh diterima', v: kg(t.kgIkan, 0), s: `${t.ekor} ekor` },
        { k: 'Loin dihasilkan', v: kg(t.kgLoin), s: `Yield ${persen(t.yield)}` },
        { k: 'Pendapatan', v: rpRingkas(t.pendapatan), s: `Biaya ${rpRingkas(t.biaya)}` },
        { k: t.laba < 0 ? 'Rugi' : 'Laba', v: rpRingkas(t.laba), s: `Margin ${persen(t.margin)}`, kelas: kelasLaba(t.laba) },
      ])}${bagianDana(dana, daftar)}
      <section><p class="eyebrow">Per siklus</p><h2>Yield dan margin tiap siklus</h2>
        <div class="dua">
          <div class="panel"><p class="muted" style="margin:0 0 10px">Yield (garis putus = rencana 60 %)</p>${batang(baris.map(({ s, r }) => ({ label: `Siklus ${s.no}`, v: r.yield })), { format: persen, target: 0.6 })}</div>
          <div class="panel"><p class="muted" style="margin:0 0 10px">Margin laba</p>${batang(baris.map(({ s, r }) => ({ label: `Siklus ${s.no}`, v: r.margin })), { format: persen })}</div>
        </div>
      </section>
      <section><div class="kepala-bagian"><div><p class="eyebrow">Daftar siklus</p><h2>Semua siklus produksi</h2></div>${tombol}</div>
        <div class="panel gulir"><table>
          <thead><tr><th>Siklus</th><th>Produksi</th><th>Pembeli</th><th class="r">Ikan</th><th class="r">Loin</th><th class="r">Yield</th><th class="r">Pendapatan</th><th class="r">Laba</th><th class="r">Margin</th></tr></thead>
          <tbody>${baris.map(
            ({ s, r }) => html`<tr><td><a href="/siklus/${s.no}">Siklus ${s.no}</a></td><td>${tgl(s.produksi)}</td><td>${s.pembeli}</td><td class="r">${kg(r.kgIkan, 0)}</td><td class="r">${kg(r.kgLoin)}</td><td class="r">${persen(r.yield)}</td><td class="r">${rp(r.pendapatan)}</td><td class="r ${r.laba < 0 ? 'turun' : ''}">${rp(r.laba)}</td><td class="r">${persen(r.margin)}</td></tr>`,
          )}
          <tr class="total"><td colspan="3">Total</td><td class="r">${kg(t.kgIkan, 0)}</td><td class="r">${kg(t.kgLoin)}</td><td class="r">${persen(t.yield)}</td><td class="r">${rp(t.pendapatan)}</td><td class="r ${t.laba < 0 ? 'turun' : ''}">${rp(t.laba)}</td><td class="r">${persen(t.margin)}</td></tr>
          </tbody></table></div>
      </section>`
    : html`${bagianDana(dana, daftar)}<section><div class="panel"><p class="muted" style="margin:0 0 12px">Belum ada siklus produksi yang tercatat.</p>${tombol}</div></section>`;

  return shell({
    judul: 'Ringkasan',
    label: `Ringkasan · ${t.siklus} siklus produksi`,
    heading: adaSiklus
      ? `${kg(t.kgLoin)} loin dari ${t.siklus} siklus, ${t.laba < 0 ? 'rugi' : 'laba'} ${rp(Math.abs(t.laba))}`
      : 'Belum ada siklus produksi',
    lead: adaSiklus
      ? `Periode ${tgl(daftar[0].produksi)} sampai ${tgl(daftar[daftar.length - 1].produksi)}. Klik satu siklus untuk rinciannya.`
      : 'Data siklus pertama belum dimasukkan.',
    nav: navSiklus(daftar, 'ringkasan'),
    peran,
    isi,
  });
}
```

- [ ] **Step 5: Implementasi rincian siklus**

```ts
// src/views/detail.ts
import { html } from 'hono/html';
import type { Role } from '../session';
import { kg, persen, ringkasSiklus, rp, rpRingkas } from '../siklus/hitung';
import type { Siklus } from '../siklus/types';
import { tgl } from './format';
import { navSiklus, shell } from './layout';
import { batang, kpi } from './widgets';

const kelasLaba = (n: number): 'naik' | 'turun' => (n < 0 ? 'turun' : 'naik');
const angka = (n: number) => n.toLocaleString('id-ID');

function grafikEkor(s: Siklus) {
  const MAKS = 0.8;
  const ramai = s.ekor.length > 20;
  const lebar = `--lebar:${s.ekor.length * 10}px`;
  const batangEkor = s.ekor.map((e) => {
    const y = e.loinKg / e.kg;
    const tinggi = Number(((Math.min(y, MAKS) / MAKS) * 100).toFixed(2));
    return html`<div class="b ${/^C/i.test(e.grade) ? 'c' : ''}" style="height:${tinggi}%" title="Tag ${e.tag}: ${kg(e.kg, 0)}, yield ${persen(y)}, grade ${e.grade}">${ramai ? '' : html`<span>${persen(y).replace(' %', '')}</span>`}</div>`;
  });
  const label = ramai
    ? ''
    : html`<div class="yx" style="${lebar}">${s.ekor.map((e) => html`<div>${e.tag}<br>${kg(e.kg, 0)}</div>`)}</div>`;
  return html`<div class="gulir"><div class="yield" style="${lebar}"><div class="garis" style="bottom:${Number(((0.6 / MAKS) * 172).toFixed(2))}px"></div>${batangEkor}</div>${label}</div>
    <div class="legend"><span><i style="background:var(--laut)"></i>Grade A/B</span><span><i style="background:var(--muted)"></i>Grade C</span><span><i style="background:var(--turun)"></i>Rencana 60 %</span></div>`;
}

export function detailPage({ daftar, siklus: s, peran }: { daftar: Siklus[]; siklus: Siklus; peran: Role }) {
  const r = ringkasSiklus(s);
  const i = daftar.findIndex((x) => x.no === s.no);
  const seb: Siklus | undefined = daftar[i - 1];
  const ses: Siklus | undefined = daftar[i + 1];
  const totalBiaya = r.biaya || 1;

  const isi = html`${kpi([
      { k: 'Ikan utuh diterima', v: kg(r.kgIkan, 0), s: `${r.ekor} ekor` },
      { k: 'Loin dihasilkan', v: kg(r.kgLoin), s: `Yield ${persen(r.yield)}` },
      { k: 'Pendapatan', v: rpRingkas(r.pendapatan), s: r.hargaRataLoin == null ? '—' : `Rata-rata loin ${rp(Math.round(r.hargaRataLoin))}/kg` },
      { k: r.laba < 0 ? 'Rugi' : 'Laba', v: rpRingkas(r.laba), s: `Margin ${persen(r.margin)}`, kelas: kelasLaba(r.laba) },
    ])}
    <section><p class="eyebrow">Produksi</p><h2>Yield per ekor</h2>
      <div class="panel">${s.ekor.length ? grafikEkor(s) : html`<p class="muted" style="margin:0">Belum ada ekor yang dicatat.</p>`}</div>
    </section>
    <section><p class="eyebrow">Hasil keuangan</p><h2>Pendapatan dan biaya</h2>
      <div class="panel gulir"><table>
        <thead><tr><th>Pos</th><th class="r">Hitungan</th><th class="r">Rp</th></tr></thead>
        <tbody>
          ${s.penjualan.map((p) => html`<tr><td>${p.nama}</td><td class="r">${kg(p.kg)} × ${angka(p.harga)}</td><td class="r">${angka(Math.round(p.kg * p.harga))}</td></tr>`)}
          <tr class="total"><td>Pendapatan</td><td></td><td class="r">${angka(r.pendapatan)}</td></tr>
          ${s.biaya.map((b) => html`<tr><td>${b.nama}</td><td></td><td class="r">${angka(b.rp)}</td></tr>`)}
          <tr class="total"><td>Biaya</td><td class="r">${r.hppPerKgLoin == null ? '' : `${rp(Math.round(r.hppPerKgLoin))}/kg loin`}</td><td class="r">${angka(r.biaya)}</td></tr>
          <tr class="total"><td>${r.laba < 0 ? 'Rugi' : 'Laba'}</td><td class="r">margin ${persen(r.margin)}</td><td class="r ${r.laba < 0 ? 'turun' : ''}">${rp(r.laba).replace('Rp ', '')}</td></tr>
        </tbody></table></div>
    </section>
    <section><p class="eyebrow">Struktur biaya</p><h2>Ke mana biayanya pergi</h2>
      <div class="panel biaya">${batang(s.biaya.map((b) => ({ label: b.nama, v: b.rp / totalBiaya })), { format: (v) => persen(v) })}</div>
    </section>
    ${s.langkah.length
      ? html`<section><p class="eyebrow">Langkah berikutnya</p><h2>Tindak lanjut</h2>
      <div class="panel"><ul class="langkah">${s.langkah.map((l) => html`<li><b>${l.judul}</b><span class="chip ${l.status}">${l.status}</span>${l.isi ? html`<p>${l.isi}</p>` : ''}</li>`)}</ul></div>
    </section>`
      : ''}
    <div class="antar">${seb ? html`<a href="/siklus/${seb.no}">← Siklus ${seb.no}</a>` : html`<span></span>`}<a href="/">Ringkasan</a>${ses ? html`<a href="/siklus/${ses.no}">Siklus ${ses.no} →</a>` : html`<span></span>`}</div>`;

  return shell({
    judul: `Siklus ${s.no}`,
    label: `Siklus ${s.no} · produksi ${tgl(s.produksi)}${s.kirim ? ` · kirim ${tgl(s.kirim)}` : ''}`,
    heading: `Siklus ${s.no}: yield ${persen(r.yield)}, ${r.laba < 0 ? 'rugi' : 'laba'} ${rp(Math.abs(r.laba))}`,
    lead: `${r.ekor} ekor tuna menjadi ${kg(r.kgLoin)} loin untuk ${s.pembeli}.`,
    nav: navSiklus(daftar, s.no),
    peran,
    isi,
  });
}
```

- [ ] **Step 6: Implementasi halaman admin**

```ts
// src/views/admin.ts
import { html } from 'hono/html';
import { rp } from '../siklus/hitung';
import type { Dana, Siklus } from '../siklus/types';
import { tgl } from './format';
import { navSiklus, shell } from './layout';

const daftarGalat = (galat?: string[]) =>
  galat && galat.length > 0 ? html`<div class="galat" role="alert"><ul>${galat.map((g) => html`<li>${g}</li>`)}</ul></div>` : '';

export interface AdminInput {
  daftar: Siklus[];
  dana: Dana[];
  pesan?: string;
  galatSiklus?: string[];
  galatDana?: string[];
}

export function adminPage({ daftar, dana, pesan, galatSiklus, galatDana }: AdminInput) {
  const isi = html`
    ${pesan ? html`<p class="sukses" role="status">${pesan}</p>` : ''}
    <section><p class="eyebrow">Siklus produksi</p><h2>Tambah siklus</h2>
      <form class="isian panel" method="post" action="/admin/siklus" enctype="multipart/form-data">
        ${daftarGalat(galatSiklus)}
        <label>Berkas siklus (.json, maksimal 512 KB)
          <input type="file" name="file" accept=".json,application/json" required>
        </label>
        <label class="cek"><input type="checkbox" name="timpa" value="1"> Timpa jika nomor sudah ada</label>
        <button class="tombol" type="submit">Unggah siklus</button>
        <p class="muted" style="margin:0;font-size:13px">Satu berkas berisi satu siklus: no, produksi, kirim, pembeli, ekor, penjualan, biaya, dan langkah. Contoh format ada di README.</p>
      </form>
      ${daftar.length === 0
        ? html`<p class="muted">Belum ada siklus.</p>`
        : html`<div class="panel gulir"><table>
          <thead><tr><th>Siklus</th><th>Produksi</th><th>Pembeli</th><th></th></tr></thead>
          <tbody>${daftar.map(
            (s) => html`<tr><td><a href="/siklus/${s.no}">Siklus ${s.no}</a></td><td>${tgl(s.produksi)}</td><td>${s.pembeli}</td><td class="r"><form method="post" action="/admin/siklus/${s.no}/hapus"><button class="tombol bahaya" type="submit">Hapus</button></form></td></tr>`,
          )}</tbody></table></div>`}
    </section>
    <section><p class="eyebrow">Dana investor</p><h2>Tambah dana</h2>
      <form class="isian panel" method="post" action="/admin/dana">
        ${daftarGalat(galatDana)}
        <label>Tanggal diterima <input type="date" name="tanggal" required></label>
        <label>Jumlah (rupiah) <input type="text" name="jumlah" inputmode="numeric" placeholder="1.367.000.000" maxlength="20" required></label>
        <label>Keterangan (opsional) <input type="text" name="keterangan" maxlength="200"></label>
        <button class="tombol" type="submit">Tambah dana</button>
      </form>
      ${dana.length === 0
        ? html`<p class="muted">Belum ada dana.</p>`
        : html`<div class="panel gulir"><table>
          <thead><tr><th>Tanggal</th><th>Keterangan</th><th class="r">Jumlah</th><th></th></tr></thead>
          <tbody>${dana.map(
            (d) => html`<tr><td>${tgl(d.tanggal)}</td><td>${d.keterangan}</td><td class="r">${rp(d.jumlah)}</td><td class="r"><form method="post" action="/admin/dana/${d.id}/hapus"><button class="tombol bahaya" type="submit">Hapus</button></form></td></tr>`,
          )}</tbody></table></div>`}
    </section>`;

  return shell({
    judul: 'Kelola',
    heading: 'Kelola data',
    lead: 'Tambah, timpa, atau hapus siklus produksi, dan catat dana investor.',
    nav: navSiklus(daftar, 'admin'),
    peran: 'admin',
    isi,
  });
}
```

- [ ] **Step 7: Jalankan, harus lolos**

Run: `npx vitest run && npx tsc --noEmit`
Expected: semua PASS. Bila ada tes yang gagal karena teks, perbaiki kode agar sesuai tes (tes menyatakan perilaku yang diwajibkan spec), kecuali tes jelas salah hitung terhadap `samples/siklus-contoh.json`; kasus itu catat sebagai Ruling.

- [ ] **Step 8: Commit**

```bash
git add src/views tests/views.test.ts
git commit -m "feat: halaman Ringkasan, rincian siklus, dan admin" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Aplikasi: ganti rute laporan dengan dasbor (sisi baca)

**Files:**
- Modify: `src/app.ts` (tulis ulang), `src/store/types.ts` (hapus tipe laporan), `src/store/from-env.ts`, `src/bootstrap.ts`, `src/dev.ts`, `tests/helpers.ts`, `tests/app.test.ts` (tulis ulang)
- Delete: `src/pages.ts`, `src/store/report-store.ts`, `tests/report-store.test.ts`, `tests/admin.test.ts`, `samples/laporan-contoh.html`
- Test: `tests/app.test.ts`, `tests/bootstrap.test.ts` (tidak diubah; harus tetap lolos)

**Interfaces:**
- Consumes: semua dari Task 1–5.
- Produces:
  - `interface Deps { config: Config; siklus: SiklusStore; dana: DanaStore; limiter: LoginLimiter; now?: () => number }`; `createApp(deps: Deps): Hono`
  - `interface Stores { siklus: SiklusStore; dana: DanaStore }`; `createStoresFromEnv(env: Record<string, string | undefined>): Stores` (melempar `ConfigError` bila di Vercel tanpa token Blob)
  - Rute: `GET /aset/logo-putih.png` (publik), `GET /` , `GET /siklus/:no`, `GET /admin` (admin), `POST /logout`; rute POST admin ditambahkan di Task 7.
  - `tests/helpers.ts`: `makeApp(overrides?)` mengembalikan `{ app, siklus, dana, limiter, backend }`; `login`, `sessionCookie`, `get`, `post`, konstanta `ADMIN`, `OWNER`, `SECRET`, `ORIGIN` tetap.

- [ ] **Step 1: Ganti pembantu tes**

```ts
// tests/helpers.ts
import { createApp, type Deps } from '../src/app';
import { createLoginLimiter } from '../src/rate-limit';
import { createDanaStore } from '../src/store/dana-store';
import { createMemoryBackend } from '../src/store/memory-backend';
import { createSiklusStore } from '../src/store/siklus-store';

export const ADMIN = 'admin-password-123';
export const OWNER = 'owner-password-123';
export const SECRET = 's'.repeat(32);
export const ORIGIN = 'http://localhost';

export function makeApp(overrides: Partial<Deps> = {}) {
  const backend = createMemoryBackend();
  const siklus = createSiklusStore(backend);
  const dana = createDanaStore(backend);
  const limiter = createLoginLimiter();
  const app = createApp({
    config: { adminPassword: ADMIN, ownerPassword: OWNER, sessionSecret: SECRET },
    siklus,
    dana,
    limiter,
    ...overrides,
  });
  return { app, siklus, dana, limiter, backend };
}

type App = ReturnType<typeof makeApp>['app'];

export async function login(app: App, password: string, headers: Record<string, string> = {}) {
  return app.request('/login', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams({ password }).toString(),
  });
}

export async function sessionCookie(app: App, password: string): Promise<string> {
  const setCookie = (await login(app, password)).headers.get('set-cookie');
  if (!setCookie) throw new Error('login gagal');
  return setCookie.split(';')[0];
}

export const get = (app: App, path: string, cookie?: string) =>
  app.request(path, { headers: cookie ? { cookie } : {} });

export const post = (app: App, path: string, cookie: string, body?: BodyInit, headers: Record<string, string> = {}) =>
  app.request(path, { method: 'POST', body, headers: { origin: ORIGIN, cookie, ...headers } });
```

- [ ] **Step 2: Tulis ulang tes aplikasi (harus gagal)**

Hapus berkas lama yang bergantung pada laporan, lalu tulis tes baru:

```bash
git rm -q tests/admin.test.ts tests/report-store.test.ts
```

```ts
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

  it('POST /login dari origin lain ditolak sebelum memeriksa sandi', async () => {
    const { app } = makeApp();
    const res = await app.request('/login', {
      method: 'POST',
      headers: { origin: 'https://situs-lain.example', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: ADMIN }).toString(),
    });
    expect(res.status).toBe(403);
    expect(res.headers.get('set-cookie')).toBeNull();
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
```

Run: `npx vitest run tests/app.test.ts`
Expected: FAIL (aplikasi lama masih memakai `store`/laporan; `createApp` tidak menerima `siklus` dan `dana`, banyak galat tipe/rute).

- [ ] **Step 3: Implementasi aplikasi baru**

```ts
// src/app.ts
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { LOGO_PNG_BASE64 } from './assets/logo';
import type { Config } from './config';
import { safeEqual } from './passwords';
import type { LoginLimiter } from './rate-limit';
import { createSession, readSession, SESSION_TTL_SECONDS, type Role } from './session';
import { parseNo } from './store/siklus-store';
import type { DanaStore, SiklusStore } from './store/types';
import { adminPage } from './views/admin';
import { detailPage } from './views/detail';
import { loginPage, messagePage } from './views/layout';
import { ringkasanPage } from './views/ringkasan';

export interface Deps {
  config: Config;
  siklus: SiklusStore;
  dana: DanaStore;
  limiter: LoginLimiter;
  now?: () => number;
}

type AppEnv = { Variables: { role: Role | null } };
type AppContext = Context<AppEnv>;

const COOKIE = 'overview_session';
const APP_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const LOGO_PNG = Uint8Array.from(Buffer.from(LOGO_PNG_BASE64, 'base64'));

const PESAN: Record<string, string> = {
  added: 'Siklus ditambahkan.',
  replaced: 'Siklus diganti.',
  removed: 'Siklus dihapus.',
  dana: 'Dana ditambahkan.',
  danahapus: 'Dana dihapus.',
};

const clientKey = (headers: Headers) =>
  headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
  headers.get('x-forwarded-for')?.split(',')[0].trim() ||
  'unknown';

export function createApp({ config, siklus, dana, limiter, now = Date.now }: Deps) {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Strict-Transport-Security', 'max-age=31536000');
    c.header('Content-Security-Policy', APP_CSP);
    await next();
  });

  // Semua metode selain GET/HEAD harus berasal dari origin yang sama; header hilang berarti ditolak.
  app.use('*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.header('origin') !== new URL(c.req.url).origin) {
      return c.html(messagePage('Ditolak', 'Permintaan tidak berasal dari situs ini.'), 403);
    }
    await next();
  });

  app.use('*', async (c, next) => {
    const token = getCookie(c, COOKIE, 'host');
    c.set('role', token ? await readSession(token, config.sessionSecret, now()) : null);
    await next();
  });

  app.get('/robots.txt', (c) => c.text('User-agent: *\nDisallow: /\n'));

  // Logo perusahaan: statis dan tidak rahasia, jadi boleh dilihat di halaman login dan di-cache.
  app.get('/aset/logo-putih.png', (c) => {
    c.header('Cache-Control', 'public, max-age=86400');
    return c.body(LOGO_PNG, 200, { 'Content-Type': 'image/png' });
  });

  app.get('/login', (c) => (c.get('role') ? c.redirect('/', 303) : c.html(loginPage())));

  app.post('/login', async (c) => {
    const key = clientKey(c.req.raw.headers);
    if (limiter.isBlocked(key)) {
      const wait = limiter.retryAfterSeconds(key);
      c.header('Retry-After', String(wait));
      return c.html(messagePage('Terlalu banyak percobaan', `Coba lagi dalam ${Math.ceil(wait / 60)} menit.`), 429);
    }

    const body = await c.req.parseBody();
    const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
    // Kedua perbandingan selalu dijalankan agar waktu tidak membedakan peran.
    const [isAdmin, isOwner] = await Promise.all([
      safeEqual(password, config.adminPassword),
      safeEqual(password, config.ownerPassword),
    ]);
    const role: Role | null = isAdmin ? 'admin' : isOwner ? 'owner' : null;

    if (!role) {
      limiter.recordFailure(key);
      return c.html(loginPage('Sandi salah.'), 401);
    }
    limiter.reset(key);
    setCookie(c, COOKIE, await createSession(role, config.sessionSecret, now()), {
      prefix: 'host',
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return c.redirect('/', 303);
  });

  // Semua rute di bawah ini membutuhkan sesi.
  app.use('*', async (c, next) => {
    if (c.get('role')) return next();
    if (c.req.method === 'GET' || c.req.method === 'HEAD') return c.redirect('/login', 303);
    return c.html(messagePage('Perlu login', 'Silakan login terlebih dahulu.'), 401);
  });

  const adminOnly = async (c: AppContext, next: () => Promise<void>) =>
    c.get('role') === 'admin'
      ? next()
      : c.html(messagePage('Akses ditolak', 'Halaman ini hanya untuk admin.'), 403);
  app.use('/admin', adminOnly);
  app.use('/admin/*', adminOnly);

  app.post('/logout', (c) => {
    deleteCookie(c, COOKIE, { prefix: 'host', path: '/', secure: true });
    return c.redirect('/login', 303);
  });

  app.get('/', async (c) =>
    c.html(ringkasanPage({ daftar: await siklus.list(), dana: await dana.list(), peran: c.get('role') as Role })),
  );

  const notFound = (c: AppContext) => c.html(messagePage('Tidak ditemukan', 'Siklus tidak ada.'), 404);

  app.get('/siklus/:no', async (c) => {
    const no = parseNo(c.req.param('no'));
    if (no === null) return notFound(c);
    const daftar = await siklus.list();
    const ditemukan = daftar.find((s) => s.no === no);
    return ditemukan ? c.html(detailPage({ daftar, siklus: ditemukan, peran: c.get('role') as Role })) : notFound(c);
  });

  const renderAdmin = async (
    c: AppContext,
    status: 200 | 400 | 413,
    tambahan: { pesan?: string; galatSiklus?: string[]; galatDana?: string[] } = {},
  ) => c.html(adminPage({ daftar: await siklus.list(), dana: await dana.list(), ...tambahan }), status);

  app.get('/admin', (c) => {
    const kunci = Object.keys(PESAN).find((k) => c.req.query(k));
    return renderAdmin(c, 200, { pesan: kunci ? PESAN[kunci] : undefined });
  });

  // Rute POST admin (unggah dan hapus siklus, tambah dan hapus dana) ditambahkan di Task 7.

  app.notFound((c) => c.html(messagePage('Tidak ditemukan', 'Halaman tidak ada.'), 404));
  app.onError((error, c) => {
    console.error(error);
    return c.html(messagePage('Terjadi kesalahan', 'Coba lagi sebentar lagi.'), 500);
  });

  return app;
}
```

Perbarui pemilihan penyimpanan dan titik masuk:

```ts
// src/store/from-env.ts
import { ConfigError } from '../config';
import { createBlobBackend } from './blob-backend';
import { createDanaStore } from './dana-store';
import { createFileBackend } from './file-backend';
import { createSiklusStore } from './siklus-store';
import type { DanaStore, ObjectBackend, SiklusStore } from './types';

export interface Stores {
  siklus: SiklusStore;
  dana: DanaStore;
}

export const storesDariBackend = (backend: ObjectBackend): Stores => ({
  siklus: createSiklusStore(backend),
  dana: createDanaStore(backend),
});

export function createStoresFromEnv(env: Record<string, string | undefined>): Stores {
  if (env.BLOB_READ_WRITE_TOKEN) return storesDariBackend(createBlobBackend());
  if (env.VERCEL) throw new ConfigError(['BLOB_READ_WRITE_TOKEN wajib diisi (hubungkan Blob store ke project)']);
  return storesDariBackend(createFileBackend('.data'));
}
```

```ts
// src/bootstrap.ts
import { Hono } from 'hono';
import { createApp } from './app';
import { ConfigError, loadConfig } from './config';
import { createLoginLimiter } from './rate-limit';
import { createStoresFromEnv } from './store/from-env';

// Tidak pernah melempar: konfigurasi buruk menghasilkan aplikasi yang menutup semua rute dengan 503.
export function buildApp(env: Record<string, string | undefined>) {
  try {
    const config = loadConfig(env);
    return createApp({ config, ...createStoresFromEnv(env), limiter: createLoginLimiter() });
  } catch (error) {
    console.error(error instanceof ConfigError ? error.message : 'Aplikasi gagal dimulai');
    const closed = new Hono();
    closed.all('*', (c) => c.text('Layanan belum dikonfigurasi.', 503));
    return closed;
  }
}
```

```ts
// src/dev.ts
import { serve } from '@hono/node-server';
import { readFile } from 'node:fs/promises';
import { buildApp } from './bootstrap';
import { parseSiklus } from './siklus/validasi';
import { createFileBackend } from './store/file-backend';
import { storesDariBackend } from './store/from-env';

// Nilai bawaan hanya untuk pengembangan lokal; produksi memakai env var Vercel.
const env: Record<string, string | undefined> = {
  ADMIN_PASSWORD: 'dev-admin-password',
  OWNER_PASSWORD: 'dev-owner-password',
  SESSION_SECRET: 'dev-session-secret-for-local-use-only',
  ...process.env,
};

// Menyemai data contoh (fiktif) bila penyimpanan lokal masih kosong.
const stores = storesDariBackend(createFileBackend('.data'));
if ((await stores.siklus.list()).length === 0) {
  const hasil = parseSiklus(await readFile('samples/siklus-contoh.json', 'utf8'));
  if (!hasil.ok) throw new Error(`samples/siklus-contoh.json tidak valid: ${hasil.galat.join('; ')}`);
  await stores.siklus.put(hasil.siklus, { timpa: false });
}
if ((await stores.dana.list()).length === 0) {
  await stores.dana.add({ tanggal: '2026-10-06', jumlah: 1367000000, keterangan: 'Dana investor contoh (fiktif)' });
}

const port = Number(env.PORT ?? 3000);
serve({ fetch: buildApp(env).fetch, port }, () => {
  console.log(`http://localhost:${port}  (admin: ${env.ADMIN_PASSWORD}, owner: ${env.OWNER_PASSWORD})`);
});
```

Hapus kode laporan lama:

```bash
git rm -q src/pages.ts src/store/report-store.ts samples/laporan-contoh.html
```

Lalu hapus dua blok `ReportMeta` dan `ReportStore` (beserta komentar "Dihapus di Task 6 bersama report-store.") dari `src/store/types.ts`.

- [ ] **Step 4: Jalankan, harus lolos**

Run: `npx vitest run && npx tsc --noEmit`
Expected: semua PASS, termasuk `tests/bootstrap.test.ts` yang tidak diubah (503 saat konfigurasi lemah tetap). `tsc` tanpa galat. Bila `c.body(LOGO_PNG, …)` ditolak `tsc` karena tipe `Uint8Array`, ubah anotasi tipe tanpa mengubah perilaku dan catat Ruling.

- [ ] **Step 5: Pastikan tidak ada sisa kode laporan**

Run: `grep -rnE "ReportStore|report-store|ReportMeta|/raw/|RAW_CSP|laporan-contoh" src tests`
Expected: tanpa keluaran (kecuali tes "rute laporan lama ... sudah tidak ada" yang memuat string `/raw/laporan-0001`; itu sengaja).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: dasbor siklus menggantikan rute laporan HTML" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rute admin: unggah dan hapus siklus, tambah dan hapus dana

**Files:**
- Modify: `src/app.ts` (tambahkan rute POST setelah `app.get('/admin', …)`)
- Test: `tests/admin.test.ts` (baru)

**Interfaces:**
- Consumes: `parseSiklus`, `parseDana` (Task 2), `SiklusSudahAdaError`, `parseNo` (Task 3), `BatasDanaError`, `isValidDanaId` (Task 3), `renderAdmin` dan `notFound` (Task 6).
- Produces: `POST /admin/siklus` (multipart: `file`, `timpa`), `POST /admin/siklus/:no/hapus`, `POST /admin/dana` (form: `tanggal`, `jumlah`, `keterangan`), `POST /admin/dana/:id/hapus`. Pengalihan sukses (303): `/admin?added=1`, `/admin?replaced=1`, `/admin?removed=1`, `/admin?dana=1`, `/admin?danahapus=1`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
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
```

- [ ] **Step 2: Jalankan, harus gagal**

Run: `npx vitest run tests/admin.test.ts`
Expected: FAIL (rute `POST` belum ada: 404 untuk pengguna admin).

- [ ] **Step 3: Implementasi**

Tambahkan impor di `src/app.ts`:

```ts
import { parseDana, parseSiklus } from './siklus/validasi';
import { BatasDanaError, isValidDanaId } from './store/dana-store';
import { parseNo, SiklusSudahAdaError } from './store/siklus-store';
```

(ganti impor `parseNo` yang sudah ada dengan baris gabungan di atas). Ganti komentar `// Rute POST admin ... ditambahkan di Task 7.` dengan:

```ts
  const MAX_UPLOAD_BYTES = 512 * 1024;

  app.post('/admin/siklus', async (c) => {
    const tolak = (status: 400 | 413, galat: string[]) => renderAdmin(c, status, { galatSiklus: galat });

    const body = await c.req.parseBody();
    const file = body.file;
    const timpa = body.timpa === '1';

    if (!(file instanceof File) || file.size === 0) return tolak(400, ['Pilih berkas JSON yang tidak kosong.']);
    if (!/\.json$/i.test(file.name)) return tolak(400, ['Berkas harus berakhiran .json.']);
    if (file.size > MAX_UPLOAD_BYTES) return tolak(413, ['Ukuran berkas maksimal 512 KB.']);

    let teks: string;
    try {
      // TextDecoder membuang BOM UTF-8 di awal berkas (umum dari Notepad dan Excel).
      teks = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    } catch {
      return tolak(400, ['Berkas harus berupa teks UTF-8.']);
    }

    const hasil = parseSiklus(teks);
    if (!hasil.ok) return tolak(400, hasil.galat);

    try {
      const status = await siklus.put(hasil.siklus, { timpa });
      return c.redirect(status === 'diganti' ? '/admin?replaced=1' : '/admin?added=1', 303);
    } catch (error) {
      if (error instanceof SiklusSudahAdaError) {
        return tolak(400, [`Siklus ${error.no} sudah ada. Centang "Timpa jika nomor sudah ada" untuk menggantinya.`]);
      }
      throw error;
    }
  });

  app.post('/admin/siklus/:no/hapus', async (c) => {
    const no = parseNo(c.req.param('no'));
    const dihapus = no !== null && (await siklus.remove(no));
    return dihapus ? c.redirect('/admin?removed=1', 303) : notFound(c);
  });

  app.post('/admin/dana', async (c) => {
    const body = await c.req.parseBody();
    const hasil = parseDana({ tanggal: body.tanggal, jumlah: body.jumlah, keterangan: body.keterangan });
    if (!hasil.ok) return renderAdmin(c, 400, { galatDana: hasil.galat });
    try {
      await dana.add(hasil.dana);
    } catch (error) {
      if (error instanceof BatasDanaError) return renderAdmin(c, 400, { galatDana: [error.message] });
      throw error;
    }
    return c.redirect('/admin?dana=1', 303);
  });

  app.post('/admin/dana/:id/hapus', async (c) => {
    const id = c.req.param('id');
    const dihapus = isValidDanaId(id) && (await dana.remove(id));
    return dihapus ? c.redirect('/admin?danahapus=1', 303) : notFound(c);
  });
```

Pastikan `notFound` (Task 6) dan `renderAdmin` berada di atas blok ini.

- [ ] **Step 4: Jalankan, harus lolos**

Run: `npx vitest run && npx tsc --noEmit`
Expected: semua PASS, `tsc` tanpa galat. Bila ada tes yang gagal karena perilaku Hono (mis. atribut cookie, header yang tertimpa, URL dengan spasi), perbaiki kode atau cara tes memanggil `app.request`, bukan melemahkan asersi.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: unggah dan hapus siklus, tambah dan hapus dana oleh admin" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Smoke lokal, pembersihan `investor/`, dokumentasi, dan verifikasi akhir

**Files:**
- Create: `README.md`
- Delete: `investor/` (setelah snapshot di riwayat)
- Modify: tidak ada kode, kecuali perbaikan dari tinjauan.

- [ ] **Step 1: Periksa `investor/` dan bandingkan angka**

```bash
cd /c/overview
git diff --stat -- investor | tail -1
node -e "globalThis.window=globalThis; const H=require('./investor/hitung.js'); require('./investor/siklus.js'); const d=H.periksa(window.SIKLUS); const p=H.posisiDana(H.periksaDana(window.DANA), d); console.log(JSON.stringify({t:H.ringkasSemua(d), p}))"
```

Expected: keluaran memuat `pendapatan:41576150`, `biaya:37072682`, `laba:4503468`, `sisa:1371503468` (sama dengan yang diasersikan tes Task 1 dan Task 5). Bila `investor/` berubah sejak rencana ditulis, bandingkan rumus dan teks halaman dengan port, perbarui port dan tesnya, dan catat Ruling.

- [ ] **Step 2: Smoke lokal dengan server nyata**

Run (latar belakang): `npm run dev`, lalu:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/robots.txt
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3000/aset/logo-putih.png
curl -s -i -H "Origin: http://localhost:3000" -d "password=dev-owner-password" http://localhost:3000/login | head -12
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://situs-jahat.example" http://localhost:3000/admin/dana
```

Expected: `303 http://localhost:3000/login`, `200`, `200 image/png`, `303` ke `/` dengan `Set-Cookie: __Host-overview_session=...; HttpOnly; Secure; SameSite=Strict`, dan `403`. Catatan: `curl` menolak mengirim ulang cookie `Secure` lewat HTTP, jadi pemeriksaan halaman berlogin dilakukan di browser pada `http://localhost:3000`. Bila ekstensi Chrome tersedia, login sebagai owner (sandi dari keluaran `npm run dev`), periksa Ringkasan (kartu angka, Dana investor, batang), buka Siklus 1, pastikan tidak ada tombol "Tambah siklus"; login sebagai admin, unggah `samples/siklus-contoh.json` dengan nomor diubah menjadi 2, timpa, hapus, tambah dan hapus satu dana; uji lebar ponsel dan mode gelap. Bila ekstensi tidak terhubung, catat "pemeriksaan browser belum dilakukan" di ledger dan laporan akhir; jangan mencoba ulang. Hentikan server setelahnya.

- [ ] **Step 3: Snapshot lalu hapus `investor/`**

```bash
git add investor
git commit -m "chore: simpan versi terakhir investor/ di riwayat sebelum dihapus" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git rm -rq investor
git commit -m "chore: hapus investor/ (sudah diporting ke src/siklus dan src/views)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Expected: dua commit; `ls investor` gagal; `npx vitest run` masih lolos (tes membaca `samples/siklus-contoh.json`, bukan `investor/`); `src/assets/logo.ts` sudah menyimpan logo sendiri. Bila `git add investor` tidak menunjukkan perubahan baru, hanya commit kedua yang dibuat.

- [ ] **Step 4: Tulis `README.md`** (bahasa Indonesia)

Isi wajib, urut:
1. Tujuan satu paragraf: dasbor siklus produksi dengan dua peran.
2. Menjalankan lokal: `npm install`, `npm run dev`, alamat `http://localhost:3000`, nilai bawaan dev (dicetak di terminal), data contoh disemai di `.data/`.
3. Tabel env var (nama, aturan, tempat mengisi): `ADMIN_PASSWORD` (>= 12), `OWNER_PASSWORD` (>= 12, beda), `SESSION_SECRET` (>= 32), `BLOB_READ_WRITE_TOKEN` (otomatis dari Blob store); semuanya diisi di Vercel (Settings, Environment Variables), bukan di berkas.
4. Format berkas siklus: salin isi `samples/siklus-contoh.json` sebagai contoh lengkap dan jelaskan tiap bidang, aturan (nomor 1–9999; tanggal `YYYY-MM-DD`; harga dan rp bilangan bulat rupiah tanpa titik; berat desimal dengan titik; `loinKg` tidak melebihi `kg`; status `selesai` atau `berjalan`; maksimal 512 KB, UTF-8; batas jumlah baris dan panjang teks), cara menimpa (centang "Timpa") dan menghapus.
5. Dana investor: form di halaman Kelola (tanggal, jumlah boleh diketik dengan titik, keterangan), dihitung di Ringkasan dengan anggapan yang tertulis di halaman.
6. Mengganti sandi: ubah env var di Vercel lalu deploy ulang; ganti `SESSION_SECRET` untuk mengeluarkan semua sesi.
7. Keterbatasan: dua sandi bersama; pembatas login best effort (tambahkan aturan rate limit Firewall Vercel pada `/login`); dua admin yang menulis serentak bisa saling menimpa; owner melihat semua angka keuangan termasuk dana; sisa dana adalah perkiraan.
8. Langkah rilis dari spec lama bagian 10 persis, dengan langkah 4 sampai 8 ditandai "menunggu konfirmasi pemilik"; pemeriksaan manual langkah 8 mengikuti spec baru bagian 11.

- [ ] **Step 5: Verifikasi akhir**

Run: `npm run check` dan `grep -rnE "ReportStore|report-store|ReportMeta|RAW_CSP|laporan-contoh|investor/" src tests README.md`
Expected: `tsc` tanpa galat dan seluruh tes lolos (laporkan jumlahnya apa adanya); `grep` tanpa keluaran selain tes "rute laporan lama … sudah tidak ada" dan, bila disengaja, satu sebutan `investor/` di README tentang riwayat.

- [ ] **Step 6: Tinjauan**

Satu peninjau baru atas seluruh diff sejak `7974b10` terhadap spec `2026-10-08-overview-siklus-design.md` dan Global Constraints, dengan bagian Review Focus di atas disalin apa adanya. Perbaiki temuan Critical dan Important dengan tes yang gagal lebih dulu; temuan Minor dicatat.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: panduan menjalankan dan merilis dasbor siklus" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Berhenti dan laporkan ke pemilik.** Jangan membuat repo GitHub, project Vercel, Blob store, env var, domain, atau DNS. Minta konfirmasi pemilik untuk langkah rilis spec lama bagian 10 (4 sampai 8). Sandi dibuat dan diisi sendiri oleh pemilik di dashboard Vercel. Laporkan juga pemeriksaan browser yang belum dilakukan (bila ada) dan semua Ruling.
