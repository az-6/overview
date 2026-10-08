# Dasbor Siklus Produksi — overview.katalislintasglobal.com

Dasbor siklus produksi PT. Katalis Lintas Global dengan dua peran: **admin** (menambah, menimpa, dan menghapus siklus lewat unggah satu berkas JSON, serta mengelola dana investor) dan **owner** (hanya melihat). Setiap kali data berubah, Ringkasan, total, yield, margin, dan sisa dana dihitung ulang otomatis saat halaman dibuka. Halaman dirender di server (Hono), tanpa JavaScript di browser.

## Menjalankan lokal

```bash
npm install
npm run dev     # http://localhost:3000
npm run check   # tsc + vitest
```

Sandi bawaan dev dicetak di terminal (admin dan owner). Data contoh fiktif disemai ke `.data/` bila kosong.

## Variabel lingkungan

Diisi di Vercel (Settings → Environment Variables), bukan di berkas.

| Nama | Aturan |
|---|---|
| `ADMIN_PASSWORD` | minimal 12 karakter |
| `OWNER_PASSWORD` | minimal 12 karakter, harus beda dari admin |
| `SESSION_SECRET` | minimal 32 karakter acak |
| `BLOB_READ_WRITE_TOKEN` | otomatis saat Blob store (privat) dihubungkan ke project |

Konfigurasi hilang atau lemah membuat semua rute menjawab 503.

## Format berkas siklus

Satu berkas `.json` (UTF-8, maks 512 KB) berisi satu siklus. Contoh lengkap: `samples/siklus-contoh.json`.

- `no`: bilangan bulat 1–9999. `produksi` dan `kirim` (opsional): tanggal `YYYY-MM-DD`. `pembeli`: teks.
- `ekor[]`: `tag`, `kg` (> 0), `loinKg` (≥ 0 dan tidak melebihi `kg`), `grade`.
- `penjualan[]`: `nama`, `kg` (> 0), `harga` (rupiah bulat tanpa titik). Pos berawalan "Loin" dihitung sebagai loin.
- `biaya[]`: `nama`, `rp` (rupiah bulat tanpa titik).
- `langkah[]`: `judul`, `isi` (opsional), `status` (`selesai` atau `berjalan`).
- Berat memakai titik desimal (27.75). Maks 500 ekor, 50 baris tiap daftar lain, 200 karakter per teks (1000 untuk `isi`).

Unggah lewat halaman **Kelola** (`/admin`). Nomor yang sudah ada ditolak kecuali kotak "Timpa jika nomor sudah ada" dicentang. Hapus lewat tombol Hapus pada tabel.

## Dana investor

Form di halaman Kelola: tanggal, jumlah (boleh diketik `1.367.000.000`), keterangan. Bagian Dana investor muncul di Ringkasan bila ada entri; sisa dana dihitung dengan anggapan semua penjualan dibayar dan semua biaya lunas.

## Mengganti sandi

Ubah env var di Vercel lalu deploy ulang. Mengganti `SESSION_SECRET` mengeluarkan semua sesi.

## Keterbatasan

- Satu sandi per peran dibagi banyak orang.
- Pembatas login hanya *best effort*; tambahkan aturan rate limit Firewall Vercel pada `/login`.
- Dua admin yang menulis serentak bisa saling menimpa.
- Owner melihat semua angka keuangan, termasuk dana investor. Sisa dana adalah perkiraan.

## Rilis (menunggu konfirmasi pemilik untuk langkah 4–8)

1. Implementasi dan tes lokal. ✔
2. Repo GitHub terpisah untuk project ini.
3. `npm run check` lolos. ✔
4. Buat project Vercel baru dari repo itu (terpisah dari company profile).
5. Buat Blob store privat dan hubungkan ke project.
6. Isi `ADMIN_PASSWORD`, `OWNER_PASSWORD`, `SESSION_SECRET` di Vercel (dibuat pemilik sendiri).
7. Tambah domain `overview.katalislintasglobal.com` ke project; CNAME `overview` di DNS bila DNS tidak dikelola Vercel.
8. Pemeriksaan manual: login dua peran; unggah siklus dummy; periksa Ringkasan dan rincian; pastikan owner tidak melihat tombol Tambah siklus dan mendapat 403 di `/admin`; timpa dan hapus siklus dummy; tambah dan hapus dana dummy; tambah aturan rate limit Firewall pada `/login`.
