# Dasbor Siklus Produksi (overview.katalislintasglobal.com)

**Tanggal:** 8 Oktober 2026
**Status:** Rancangan disetujui pemilik dalam sesi brainstorming; diperbarui setelah pemilik menambah bagian "Dana investor" di `investor/` (form sederhana di `/admin`); menunggu tinjauan spec tertulis
**Menggantikan sebagian:** `2026-10-08-overview-reports-design.md`. Dari spec itu tetap berlaku bagian 3 (arsitektur dan modul dasar), 4 (login dan sesi), 8 (kegagalan konfigurasi), dan 10 (rilis). Bagian 5 (halaman), 6 (laporan HTML bersandbox), dan 7 (penyimpanan laporan) digantikan oleh dokumen ini.
**Lokasi:** `C:\overview`

## 1. Ringkasan

Setelah login, pengguna melihat dasbor **siklus produksi** seperti contoh `investor/index.html`: halaman Ringkasan dan satu halaman rinci per siklus. **owner** hanya melihat. **Admin** juga melihat tombol **Tambah siklus**, mengunggah satu berkas JSON per siklus, menimpa siklus yang sudah ada, dan menghapus siklus. Semua halaman dirender di server oleh Hono tanpa JavaScript di browser. Fitur unggah dan sajian laporan HTML dihapus seluruhnya.

Ringkasan juga memuat bagian **Dana investor** (dana yang diterima, terpakai untuk biaya produksi, kembali dari penjualan, sisa, dan imbal hasil terhadap dana), seperti contoh. Admin menambah dan menghapus entri dana lewat form sederhana di `/admin` (tanggal, jumlah rupiah, keterangan). Tanpa entri dana, bagian itu tidak ditampilkan.

Yang tidak berubah: login dua sandi, sesi bertanda tangan, pembatas login, Vercel Blob privat, respons 503 saat konfigurasi lemah, dan langkah rilis.

## 2. Tujuan dan batas

**Tujuan**
- owner dan admin melihat Ringkasan dan rincian tiap siklus setelah login.
- Admin menambah, menimpa, dan menghapus siklus, serta menambah dan menghapus entri dana investor, tanpa menyentuh kode atau deploy ulang.
- Data tidak dapat dibuka tanpa login dan tidak muncul di mesin pencari.
- Isi data yang diunggah (nama, catatan, dan sebagainya) tidak pernah dapat menjalankan skrip atau mengubah halaman.

**Bukan tujuan**
- Form edit di browser, riwayat versi, impor CSV, ekspor, pencarian, atau akun per orang.
- Mengubah rumus perhitungan dari `investor/hitung.js`.
- Menyajikan HTML buatan pihak lain.

**Asumsi**
- Data siklus kecil (puluhan siklus, masing-masing puluhan ekor). Satu dokumen JSON cukup.
- owner boleh melihat biaya, pendapatan, dan laba (sesuai contoh pemilik).
- Data contoh di `investor/siklus.js` fiktif.

## 3. Arsitektur

Aplikasi Hono, `createApp(deps)` tetap menerima konfigurasi, penyimpanan, dan pembatas login, sehingga semuanya diuji lewat `app.request()`.

| Modul | Keadaan | Tanggung jawab |
|---|---|---|
| `src/config.ts`, `passwords.ts`, `session.ts`, `rate-limit.ts` | tetap | Konfigurasi, sandi, sesi, pembatas |
| `src/store/types.ts` | diubah | `ObjectBackend` tetap; `ReportMeta` dan `ReportStore` diganti `Siklus`, `SiklusStore`, `Dana`, dan `DanaStore` |
| `src/store/dana-store.ts` | baru | `DanaStore` di atas `ObjectBackend` (dokumen `data/dana.json`) |
| `src/store/memory-backend.ts`, `file-backend.ts`, `blob-backend.ts`, `from-env.ts` | tetap (`from-env` memakai store baru) | Backend objek |
| `src/store/report-store.ts` | dihapus | Diganti `src/store/siklus-store.ts` |
| `src/siklus/hitung.ts` | baru | Port TypeScript dari `investor/hitung.js` (versi terbaru, termasuk dana): `ringkasSiklus`, `ringkasSemua`, `posisiDana`, pemformat `rp`, `rpRingkas`, `kg`, `persen(x, desimal = 1)` |
| `src/siklus/validasi.ts` | baru | `parseSiklus(teks)`: urai JSON, periksa, kembalikan `Siklus` ternormalisasi atau daftar galat; `parseDana(input)`: periksa isian form dana |
| `src/pages.ts` | diganti isinya | Templat: pesan, login, ringkasan, detail, admin |
| `src/assets/logo.ts` | baru | Logo PNG sebagai base64 (dari `investor/logo-putih.png`) |
| `src/app.ts` | diubah | Rute dan header |
| `src/bootstrap.ts`, `index.ts`, `dev.ts` | tetap (`dev.ts` menyemai siklus contoh) | Titik masuk |
| `samples/siklus-contoh.json` | baru, menggantikan `laporan-contoh.html` | Contoh format unggahan fiktif; dipakai untuk semai lokal dan dokumentasi |
| `investor/` | dihapus setelah port dan tesnya lolos | Riwayat git menyimpannya |

## 4. Rute dan akses

| Rute | Akses | Perilaku |
|---|---|---|
| `GET /login`, `POST /login` | publik | Seperti sebelumnya, ditambah logo |
| `GET /robots.txt` | publik | `Disallow: /` |
| `GET /aset/logo-putih.png` | publik | Logo (statis, tidak rahasia), `Cache-Control: public, max-age=86400` |
| `GET /` | admin, owner | Ringkasan. Admin melihat tombol "Tambah siklus" yang menuju `/admin` |
| `GET /siklus/:no` | admin, owner | Rincian satu siklus; nomor tidak ada atau tidak valid: 404 |
| `GET /admin` | admin | Form unggah siklus, daftar siklus dengan tombol Hapus, form tambah dana, daftar dana dengan tombol Hapus |
| `POST /admin/siklus` | admin | Unggah siklus |
| `POST /admin/siklus/:no/hapus` | admin | Hapus siklus |
| `POST /admin/dana` | admin | Tambah entri dana |
| `POST /admin/dana/:id/hapus` | admin | Hapus entri dana (`:id` harus cocok `^[A-Za-z0-9_-]{8,32}$` sebelum menyentuh penyimpanan) |
| `POST /logout` | admin, owner | Keluar |

Aturan akses tidak berubah: tanpa sesi `GET` dialihkan ke `/login` (303) dan metode lain mendapat 401; owner di rute admin mendapat 403; semua `POST` mewajibkan `Origin` yang sama dengan host aplikasi (hilang atau berbeda: 403). Nomor siklus di URL harus cocok `^[1-9][0-9]{0,3}$` (1 sampai 9999) sebelum menyentuh penyimpanan.

## 5. Halaman

Tampilan mengikuti `investor/index.html` (pita biru dengan logo, navigasi bergaya chip, kartu angka, panel, tabel, batang, mode gelap, responsif), dengan perubahan yang diperlukan agar dirender di server:

- **Ringkasan (`/`)**: label "Ringkasan · N siklus produksi"; judul seperti contoh (kg loin, jumlah siklus, laba atau rugi); empat kartu angka (ikan utuh, loin dihasilkan dan yield, pendapatan dan biaya, laba atau rugi dan margin); bagian **Dana investor** bila ada entri dana (judul "Sisa dana Rp X dari Rp Y yang diterima", empat angka: dana diterima, terpakai untuk biaya produksi, kembali dari penjualan, imbal hasil terhadap dana dengan dua desimal; bilah pemakaian dana, yaitu biaya dibagi dana dibatasi 0 sampai 100 %; tabel entri bila lebih dari satu, kalimat satu baris bila hanya satu; catatan bahwa sisa dihitung dengan anggapan semua penjualan dibayar dan semua biaya lunas serta biaya di luar siklus belum termasuk); dua panel batang (yield dengan garis rencana 60 %, margin laba); tabel semua siklus dengan baris total. Judul siklus pada tabel adalah tautan ke `/siklus/:no`; tidak ada `onclick`. Tanpa siklus: judul "Belum ada siklus produksi" dan kalimat penjelas; admin melihat tombol Tambah siklus.
- **Rincian (`/siklus/:no`)**: kartu angka siklus, grafik yield per ekor (batang HTML/CSS dengan atribut `title`), tabel pendapatan dan biaya, struktur biaya, daftar langkah tindak lanjut dengan status "selesai" atau "berjalan", dan tautan sebelumnya, ringkasan, berikutnya.
- **Navigasi**: chip "Ringkasan" dan satu chip per siklus; chip aktif memakai `aria-current="page"`. owner dan admin melihat navigasi yang sama; admin tambahan melihat tautan "Kelola".
- **Admin (`/admin`)**: form unggah (berkas `.json`, kotak centang "Timpa jika nomor sudah ada") dan tabel siklus dengan tombol Hapus per baris; di bawahnya form "Tambah dana" (tanggal, jumlah, keterangan) dan tabel dana dengan tombol Hapus per baris. Teks bantuan menyebut format dan batas ukuran.
- Font: tumpukan font sistem (IBM Plex dari Google tidak dimuat). Tanggal diformat `id-ID` dengan zona `Asia/Jakarta`, angka dan rupiah dengan pemformat yang sama dengan `hitung.js`.

Semua teks dari data (pembeli, nama pos, tag, grade, judul dan isi langkah) di-escape saat dirender. Tidak ada `innerHTML`, `onclick`, atau skrip.

## 6. Format dan validasi unggahan

Satu berkas `.json` berisi satu objek siklus:

```json
{
  "no": 1,
  "produksi": "2026-10-03",
  "kirim": "2026-10-04",
  "pembeli": "PT. Contoh",
  "ekor": [{ "tag": "001", "kg": 44, "loinKg": 27.75, "grade": "B" }],
  "penjualan": [{ "nama": "Loin B-SO", "kg": 203.51, "harga": 140000 }],
  "biaya": [{ "nama": "Ikan utuh", "rp": 22126000 }],
  "langkah": [{ "judul": "Negosiasi tarif", "isi": "opsional", "status": "berjalan" }]
}
```

Aturan (aturan 1 berhenti pada galat pertama; aturan 2 dan 3 mengumpulkan semua galat isi, paling banyak 10 pesan):
1. Ukuran berkas 1 byte sampai 512 KB (524288); nama berakhiran `.json` (tanpa membedakan huruf besar kecil); isi UTF-8 valid; JSON valid dan berupa **objek** (bukan larik, `null`, atau nilai tunggal). Ukuran terlampaui: 413; lainnya 400.
2. Aturan `periksa()` dari `hitung.js` dipertahankan: `no` bilangan bulat 1 sampai 9999; `produksi` dan `kirim` (opsional) tanggal kalender yang sah `YYYY-MM-DD`; `pembeli` teks tidak kosong; `ekor`, `penjualan`, `biaya`, `langkah` berupa larik berisi objek; ekor: `kg` angka positif, `loinKg` angka ≥ 0 dan tidak melebihi `kg`, `grade` teks tidak kosong; penjualan: `nama` teks, `kg` angka positif, `harga` bilangan bulat ≥ 0; biaya: `nama` teks, `rp` bilangan bulat ≥ 0; langkah: `judul` teks, `status` "selesai" atau "berjalan".
3. Tambahan baru: `tag` pada ekor wajib teks tidak kosong; semua angka harus berhingga; `kg`, `loinKg`, dan `harga` paling besar 1.000.000, `rp` paling besar 1.000.000.000.000; jumlah baris paling banyak 500 ekor dan 50 untuk tiap daftar lain; panjang teks paling banyak 200 karakter (`isi` langkah 1000); `isi` opsional dan bila ada harus teks.
4. **Normalisasi**: objek yang disimpan dibangun ulang hanya dari bidang yang dikenal; kunci lain (termasuk `__proto__`, `constructor`) dibuang. Teks dipangkas spasi di tepinya.
5. Nomor yang sudah ada ditolak (400) dengan pesan yang menyebut kotak "Timpa", kecuali kotak itu dicentang; bila dicentang siklus lama diganti seluruhnya.

Pesan galat berbahasa Indonesia, menyebut siklus, jenis daftar, dan nomor barisnya (mis. "ekor ke-3 (tag 003): kg loin 40 lebih besar dari berat ekornya 39."), tampil di halaman admin, dan tidak ada yang tersimpan saat galat. Daftar galat dipotong pada 10 pesan pertama.

### 6a. Dana investor

Satu entri dana: `{ id, tanggal, jumlah, keterangan }`. Admin mengisi tiga kolom di form `/admin` (`tanggal` memakai `<input type="date">`, `jumlah` kolom teks, `keterangan` kolom teks opsional); `id` dibuat server (12 karakter acak `[A-Za-z0-9_-]`).

Aturan `parseDana` (mengumpulkan semua galat isian):
1. `tanggal`: tanggal kalender yang sah `YYYY-MM-DD` (2026-02-30 ditolak).
2. `jumlah`: titik pemisah ribuan dan spasi dibuang lebih dulu (ketikan "1.367.000.000" diterima); sisanya harus 1 sampai 13 angka, bilangan bulat rupiah > 0 (desimal, koma, tanda minus, huruf ditolak); paling besar 9.999.999.999.999.
3. `keterangan`: opsional, dipangkas, paling banyak 200 karakter.
4. Paling banyak 200 entri dana; entri ke-201 ditolak dengan pesan.

Perhitungan (`posisiDana(dana, daftarSiklus)`, sama dengan `investor/hitung.js`): `null` bila tidak ada dana; selain itu `diterima` = jumlah semua dana, `terpakai` = total biaya semua siklus, `kembali` = total pendapatan semua siklus, `sisa` = `diterima` − `terpakai` + `kembali`, `imbal` = laba total / `diterima`. Daftar dana ditampilkan terurut menurut tanggal naik. Bilah pemakaian = `terpakai / diterima` dibatasi 0 sampai 1.

## 7. Penyimpanan

- `SiklusStore`: `list()` (urut menurut `no` naik), `get(no)`, `put(siklus, { timpa })` (mengembalikan `"ditambah" | "diganti"` atau melempar bila ada dan `timpa` salah), `remove(no)` (mengembalikan boolean).
- Semua siklus disimpan sebagai satu larik di `data/siklus.json` pada `ObjectBackend`. Setiap operasi menulis dokumen utuh dengan satu penulisan; tidak ada berkas terpisah sehingga tidak ada keadaan setengah jadi di antara beberapa berkas.
- `DanaStore`: `list()` (urut tanggal naik, lalu `id`), `add({ tanggal, jumlah, keterangan })` (membuat `id`, melempar bila sudah 200 entri), `remove(id)` (boolean; `id` tidak valid tidak menyentuh backend). Disimpan sebagai satu larik di `data/dana.json`.
- Dokumen rusak (bukan larik atau JSON tidak valid) menimbulkan galat (500 generik), bukan daftar kosong.
- Pemilihan backend dari env tetap (Blob bila ada `BLOB_READ_WRITE_TOKEN`; berkas `.data/` tanpa `VERCEL`; 503 di Vercel tanpa token). `dev.ts` menyemai `samples/siklus-contoh.json` bila siklus kosong dan satu entri dana contoh (Rp 1.367.000.000, 2026-10-06, keterangan fiktif) bila dana kosong.
- Dua admin yang mengunggah serentak bisa saling menimpa dokumen (batas yang sudah diterima).

## 8. Keamanan

- Header respons dan aturan Origin/sesi seperti spec lama, termasuk `Cache-Control: no-store`, `X-Robots-Tag`, `Referrer-Policy`, `X-Content-Type-Options`, dan HSTS.
- CSP halaman: `default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`. `frame-src` dihapus karena tidak ada iframe. Tidak ada skrip, jadi `script-src` tidak diperlukan.
- Permukaan serangan utama adalah isi data yang dirender; seluruhnya di-escape oleh `hono/html`, dan nilai angka dirender dari angka yang sudah divalidasi, bukan dari teks mentah.
- `/aset/logo-putih.png` satu-satunya rute publik selain login dan robots.txt; tidak memuat data.
- Gaya batang memakai persentase yang dihitung dari angka tervalidasi dan dibatasi ke 0 sampai 100.

## 9. Penanganan kegagalan

| Keadaan | Perilaku |
|---|---|
| Env var hilang atau lemah, atau Vercel tanpa token Blob | 503 generik di semua rute; nama variabel di log |
| Blob tidak terjangkau atau dokumen rusak | 500 halaman galat generik; isi galat tidak ditampilkan |
| Nomor siklus tidak ada atau tidak valid | 404 |
| Unggahan tidak valid | 400 atau 413 dengan pesan di halaman admin; tidak ada yang disimpan |
| Sesi rusak, kedaluwarsa, atau peran tidak dikenal | Dianggap tanpa sesi |
| Terlalu banyak percobaan login | 429 dengan waktu tunggu |

## 10. Pengujian

Vitest lewat `app.request()`; tanpa jaringan.
- `hitung.ts`: port tes dari `investor/hitung.test.js`, ditambah kasus pembagian nol, siklus tanpa ekor, nilai negatif, dan pemformat.
- `validasi.ts`: setiap aturan bagian 6 dengan satu kasus gagal dan satu batas yang lolos (judul panjang tepat 200, 500 ekor, 512 KB); kunci `__proto__` dibuang; larik, `null`, dan JSON rusak ditolak; tanggal 30 Februari ditolak.
- `hitung.ts` (dana): port tes `posisi dana investor` (diterima 1.367.000.000, terpakai 37.072.682, kembali 41.576.150, sisa 1.371.503.468, imbal 0,33 %), `posisiDana([], [])` bernilai `null`, `persen(x, 2)`.
- `parseDana`: setiap aturan 6a dengan satu kasus gagal dan satu batas yang lolos ("1.367.000.000" diterima, jumlah 13 angka, keterangan tepat 200); tanggal 30 Februari, "1,5", "-5", "0", "abc" ditolak.
- `siklus-store.ts`: urutan, tambah, tolak duplikat tanpa `timpa`, ganti dengan `timpa`, hapus, nomor tidak valid tidak menyentuh backend, dokumen rusak menjadi galat.
- `dana-store.ts`: urutan menurut tanggal, tambah, hapus, ID tidak valid tidak menyentuh backend, batas 200 entri, dokumen rusak menjadi galat.
- Aplikasi: tanpa sesi ditolak di setiap rute; owner melihat Ringkasan dan rincian tetapi tidak ada tombol Tambah siklus dan mendapat 403 di `/admin` dan semua `POST` admin; admin melihat tombol; `Origin` hilang atau salah ditolak; unggah sukses, ditolak karena duplikat, ditimpa, dihapus; dana ditambah dan dihapus oleh admin, ditolak 403 untuk owner dan untuk `POST` tanpa Origin sah, bagian Dana investor tampil di Ringkasan hanya bila ada dana dan sama untuk kedua peran; keterangan dana bermusuhan ter-escape; semua teks bermusuhan (`<script>`, `"><img onerror>`) pada pembeli, nama pos, tag, grade, judul dan isi langkah muncul ter-escape di Ringkasan, rincian, dan admin; header keamanan dan CSP baru ada di semua respons; token sesi yang diubah ditolak; logo dapat diambil tanpa sesi dan tidak membawa cookie sesi.
- Bootstrap: 503 saat konfigurasi lemah tetap lolos (tes Task 7).
- Smoke lokal dengan server nyata dan `curl`.

Tidak bisa diuji otomatis di sini: tampilan di browser sungguhan (tata letak, mode gelap, lebar ponsel). Diperiksa manual sekali secara lokal dan sekali setelah deploy pratinjau.

## 11. Rilis

Tidak berubah dari spec lama bagian 10 (langkah 1 sampai 3 di sesi implementasi tanpa menyentuh akun; langkah 4 sampai 8 menunggu konfirmasi pemilik). Pemeriksaan manual langkah 8 diganti: login dua peran; unggah siklus dummy; periksa Ringkasan dan rincian; pastikan owner tidak melihat tombol Tambah siklus dan mendapat 403 di `/admin`; timpa dan hapus siklus dummy; tambah dan hapus entri dana dummy dan periksa bagian Dana investor; tambah aturan rate limit Firewall pada `/login`.

## 12. Risiko

- Pembatas login hanya *best effort*.
- Satu sandi dibagi banyak orang: bocor ke satu orang berarti ganti sandi untuk semua.
- owner melihat angka keuangan lengkap, termasuk jumlah dana investor, sisa dana, dan imbal hasil.
- Sisa dana adalah perkiraan (anggapan semua penjualan dibayar dan semua biaya lunas; biaya di luar siklus belum termasuk); catatan itu ditampilkan di halaman.
- Dokumen tunggal bisa saling menimpa bila dua admin mengunggah bersamaan.
- Admin perlu menyiapkan JSON sendiri; kesalahan format hanya terlihat setelah unggah (pesan galat per baris mengurangi ini).
