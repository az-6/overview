# Portal Laporan HTML (overview.katalislintasglobal.com)

**Tanggal:** 8 Oktober 2026
**Status:** Disetujui dalam sesi desain oleh pemilik; pemilik meminta spec dan rencana langsung ditulis
**Lokasi:** `C:\overview` (project baru, terpisah dari repo situs `cp-klg`)

## 1. Ringkasan

Portal kecil berisi laporan HTML yang hanya boleh dibuka setelah login. Ada dua peran: **admin** (menambah dan menghapus laporan) dan **pegawai** (hanya melihat). Admin menambah laporan dengan mengunggah berkas `.html` lewat halaman web, tanpa menyentuh kode, GitHub, atau deploy ulang. Portal berjalan di `overview.katalislintasglobal.com` sebagai project Vercel sendiri. Situs utama `katalislintasglobal.com`, branch `main`, dan pipeline Sanity tidak berubah.

## 2. Tujuan dan batas

**Tujuan**
- Pegawai membuka daftar laporan dan satu laporan dengan sandi pegawai.
- Admin menambah dan menghapus laporan dengan sandi admin.
- Isi laporan tidak pernah bisa diakses tanpa login, dan tidak muncul di mesin pencari.
- Laporan HTML yang diunggah tidak dapat mencuri sesi atau memakai hak admin.

**Bukan tujuan**
- Akun per orang, pencatatan siapa membuka apa, atau mencabut akses satu orang. Ada dua sandi bersama.
- Mengedit laporan di browser, versi laporan, pencarian, atau kategori.
- Mengubah situs perusahaan.

**Asumsi**
- Dua sandi bersama sudah cukup.
- Laporan tidak memuat data yang wajib disimpan di Indonesia. Vercel Blob berada di luar negeri.
- Laporan bersifat mandiri (CSS dan JavaScript tertanam). Laporan yang memuat sumber dari internet bisa tampil tidak lengkap (bagian 6).

## 3. Arsitektur

- Aplikasi **Hono** (TypeScript) di Vercel, tanpa database dan tanpa JavaScript di sisi browser. Halaman dirender server, form biasa.
- Penyimpanan: **Vercel Blob privat**. Tidak ada URL publik; berkas hanya keluar lewat server setelah sesi diperiksa.
- Satu fungsi pabrik `createApp(deps)` menerima konfigurasi, penyimpanan, dan pembatas login. Itu membuat seluruh aplikasi bisa diuji lewat `app.request()` tanpa jaringan.

| Modul | Tanggung jawab |
|---|---|
| `src/config.ts` | Membaca dan memvalidasi env var; gagal tertutup |
| `src/passwords.ts` | Perbandingan sandi waktu-konstan |
| `src/session.ts` | Membuat dan memverifikasi token sesi bertanda tangan |
| `src/rate-limit.ts` | Pembatas percobaan login |
| `src/store/` | `ReportStore` di atas `ObjectBackend` (memori, berkas, Blob) |
| `src/pages.ts` | Templat HTML halaman |
| `src/app.ts` | Rute, middleware, header keamanan |
| `src/index.ts` | Titik masuk Vercel; memilih penyimpanan dari env |
| `src/dev.ts` | Server lokal |

## 4. Login dan sesi

- Satu form `/login` dengan satu kolom sandi. Peran ditentukan oleh sandi mana yang cocok: sandi admin menghasilkan `admin`, sandi pegawai menghasilkan `viewer`. Pesan kegagalan sama untuk semua kasus.
- Env var: `ADMIN_PASSWORD`, `VIEWER_PASSWORD`, `SESSION_SECRET`. Panjang minimal 12, 12, dan 32 karakter; kedua sandi harus berbeda. Bila ada yang hilang atau lemah, seluruh aplikasi menjawab 503 dengan pesan generik (nama variabel dicatat di log, nilainya tidak).
- Token sesi: `base64url(payload).base64url(HMAC-SHA256)`, payload `{ r: 'admin' | 'viewer', exp }`. Cookie `__Host-overview_session`: HttpOnly, Secure, SameSite=Strict, Path=/, berlaku 12 jam. Mengganti `SESSION_SECRET` mengakhiri semua sesi.
- Perbandingan sandi lewat hash SHA-256 dengan pembanding waktu-konstan.
- **Pembatas login:** 5 kegagalan dari satu IP dalam 15 menit menghasilkan 429 sampai jendela berakhir. Disimpan di memori instance, jadi bersifat *best effort* (instance baru memulai dari nol). Perlindungan sebenarnya adalah panjang sandi dan, sebagai pelengkap, aturan rate limit di Vercel Firewall pada `/login` (langkah pemilik, bagian 10).
- `POST /logout` menghapus cookie.

## 5. Halaman dan akses

| Rute | Akses | Perilaku |
|---|---|---|
| `GET /login`, `POST /login` | publik | Form dan proses login |
| `GET /robots.txt` | publik | `Disallow: /` |
| `GET /` | admin, pegawai | Daftar laporan: judul dan tanggal unggah, terbaru dulu |
| `GET /r/:id` | admin, pegawai | Halaman dengan `iframe` ke `/raw/:id` |
| `GET /raw/:id` | admin, pegawai | HTML mentah dengan CSP ketat (bagian 6) |
| `GET /admin` | admin | Form unggah dan daftar dengan tombol hapus |
| `POST /admin/reports` | admin | Unggah |
| `POST /admin/reports/:id/delete` | admin | Hapus |
| `POST /logout` | admin, pegawai | Keluar |

- Tanpa sesi: `GET` dialihkan ke `/login` (303); metode lain mendapat 401.
- Pegawai di rute admin: 403 dengan halaman penjelasan.
- Semua `POST` mewajibkan header `Origin` yang sama dengan host aplikasi; bila hilang atau berbeda, jawabannya 403.
- Unggah: kolom `title` (wajib, maksimal 120 karakter setelah dipangkas) dan `file` (wajib). Nama berkas harus berakhiran `.html` atau `.htm`, ukuran 1 byte sampai 4 MB (batas badan Vercel 4,5 MB), isi harus UTF-8 yang valid. Pelanggaran menghasilkan 400/413 dengan pesan di halaman admin. Judul selalu di-escape saat ditampilkan.
- ID laporan: 12 karakter acak (`[A-Za-z0-9_-]`). Setiap ID yang tidak cocok dengan pola `[A-Za-z0-9_-]{8,32}` ditolak sebelum menyentuh penyimpanan (mencegah path traversal pada penyimpanan berkas).

## 6. Keamanan laporan yang diunggah

Laporan HTML dapat berisi skrip. Dua lapis pengaman:
1. `/r/:id` menampilkan laporan di `<iframe sandbox="allow-scripts" referrerpolicy="no-referrer">`, tanpa `allow-same-origin`. Skrip laporan berjalan di origin buram: tidak bisa membaca cookie atau memanggil rute admin.
2. `/raw/:id` mengirim `Content-Security-Policy: sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'`, ditambah `X-Content-Type-Options: nosniff`. Lapis ini melindungi juga bila alamat `/raw/:id` dibuka langsung di tab sendiri.

Konsekuensi: laporan tidak bisa memuat gambar, font, skrip, atau data dari internet. Laporan harus mandiri.

Halaman aplikasi (bukan `/raw`) memakai `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-src 'self'; base-uri 'none'; frame-ancestors 'none'`. Semua respons membawa `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, dan `Strict-Transport-Security`.

## 7. Penyimpanan

- `ReportStore`: `list()` (terbaru dulu), `get(id)`, `add({ title, html })`, `remove(id)`.
- Dibangun di atas `ObjectBackend { read(path), write(path, body), remove(path) }` sehingga logika toko diuji sekali dengan backend memori; backend berkas (lokal) dan Blob hanya pembungkus tipis.
- Tata letak: `reports/index.json` (daftar `{ id, title, uploadedAt, size }`) dan `reports/<id>.html`.
- Urutan tulis: `add` menulis HTML dulu lalu indeks; `remove` menulis indeks dulu lalu menghapus HTML. Kegagalan di tengah hanya meninggalkan berkas yatim, tidak pernah entri indeks tanpa isi. Satu admin diasumsikan; tulis serentak oleh dua admin bisa saling menimpa indeks.
- Pemilihan backend dari env: ada `BLOB_READ_WRITE_TOKEN` memakai Blob; tanpa itu dan tanpa `VERCEL`, memakai folder `.data/` dan menyemai `samples/laporan-contoh.html` bila kosong; tanpa token tetapi di Vercel, aplikasi menjawab 503.

## 8. Penanganan kegagalan

| Keadaan | Perilaku |
|---|---|
| Env var hilang atau lemah | 503 generik di semua rute; nama variabel di log |
| Blob tidak terjangkau | 500 dengan halaman galat generik; tidak ada isi galat ke pengguna |
| Laporan tidak ada | 404 |
| Berkas tidak valid | Pesan di halaman admin; tidak ada yang disimpan |
| Sesi rusak, kedaluwarsa, atau peran tidak dikenal | Dianggap tanpa sesi |
| Terlalu banyak percobaan login | 429 dengan waktu tunggu |

## 9. Pengujian

Vitest lewat `app.request()`; tanpa jaringan.
- Config: setiap aturan validasi, termasuk sandi kembar.
- Sesi: tanda tangan sah, token diubah, kedaluwarsa, peran palsu, rahasia berbeda.
- Pembatas: batas tepat, reset oleh waktu, kunci per IP.
- Store: urutan, ID tidak valid, hapus, kegagalan tengah tidak membuat entri tanpa isi.
- Aplikasi: tanpa sesi ditolak di setiap rute; pegawai tidak bisa membuka `/admin`, mengunggah, atau menghapus; `Origin` hilang/salah ditolak; unggah menolak ekstensi salah, berkas kosong, terlalu besar, bukan UTF-8; judul dengan `<script>` ter-escape; header keamanan ada di semua respons; `/raw` memuat CSP `sandbox`; viewer memuat `iframe` ber-`sandbox`; cookie memiliki atribut yang benar; 503 saat konfigurasi lemah.
- Smoke lokal dengan server nyata dan `curl`.

Yang **tidak** bisa diuji otomatis di sini: perilaku sandbox di browser sungguhan. Itu diperiksa manual sekali setelah deploy pratinjau (bagian 10).

## 10. Rilis

Tahap 1 sampai 3 dikerjakan di sesi implementasi tanpa menyentuh akun. Tahap 4 sampai 8 mengubah akun Vercel dan DNS pemilik dan menunggu konfirmasi.

1. Implementasi dan tes lokal; `git init`; commit.
2. Repo GitHub terpisah (disarankan) untuk project ini.
3. `npm run check` lolos.
4. Buat project Vercel dari repo itu.
5. Buat Blob store (privat) dan hubungkan ke project; `BLOB_READ_WRITE_TOKEN` terisi otomatis.
6. Isi `ADMIN_PASSWORD`, `VIEWER_PASSWORD`, `SESSION_SECRET` di Vercel (sandi dibuat pemilik, bukan oleh saya dan bukan dari chat).
7. Tambah domain `overview.katalislintasglobal.com` ke project; tambah CNAME di DNS bila DNS tidak dikelola Vercel.
8. Pemeriksaan manual: login dua peran; unggah laporan dummy; buka laporan; coba skrip dummy yang membaca `document.cookie` dan memanggil `fetch('/admin')` dan pastikan keduanya gagal; tambah aturan rate limit Firewall pada `/login`.

## 11. Risiko

- Pembatas login hanya *best effort* (bagian 4).
- Satu sandi dibagi banyak orang: bocor ke satu orang berarti ganti sandi untuk semua.
- Laporan yang bergantung pada sumber eksternal tampil tidak lengkap; admin perlu tahu itu.
- Indeks Blob bisa saling menimpa bila dua admin mengunggah bersamaan.
