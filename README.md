# Overview PT. Katalis Lintas Global

Aplikasi ini disiapkan sebagai **proyek Vercel tersendiri** untuk `overview.katalislintasglobal.com`. Domain utama `katalislintasglobal.com` tetap berada pada proyek company profile. Akun owner hanya menerima ringkasan melalui `/api/overview`; akun admin dapat membaca detail dan menambah siklus melalui `/api/cycles`.

Data dalam `siklus.js` adalah contoh fiktif. File itu tidak dimuat oleh aplikasi dan dikecualikan dari deployment. Basis data produksi mulai kosong; admin memasukkan siklus yang sebenarnya setelah login.

## Menjalankan dan memeriksa kode

```sh
cd overview
npm ci
npm test
npm run build
```

Hasil build statis berada di `public/`. API berjalan sebagai Vercel Functions dan memerlukan variabel lingkungan di bawah. Untuk menjalankan seluruh aplikasi secara lokal setelah akun Vercel terhubung, gunakan `vercel dev` dengan variabel lingkungan Development yang sesuai.

## Menyiapkan proyek Vercel

1. Masuk ke akun Vercel yang memiliki domain: `vercel login`.
2. Dari folder `overview/`, jalankan `vercel` dan pilih **Create a new project**. Jika memasang melalui Git, set **Root Directory** proyek ke `overview`. Jangan menautkan folder ini ke proyek company profile.
3. Di proyek baru, buka **Storage** dan sambungkan Neon Postgres untuk lingkungan Production. Pastikan variabel `DATABASE_URL` tersedia pada proyek. Tabel `cycles` dibuat otomatis pada permintaan data pertama.
4. Di **Settings → Environment Variables**, atur `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `OWNER_USERNAME`, dan `OWNER_PASSWORD_HASH` untuk Production. Nama pengguna admin dan owner harus berbeda. Isi `SESSION_SECRET` dengan string acak minimal 32 karakter. Contoh pembuatan di terminal: `node -p "require('node:crypto').randomBytes(32).toString('hex')"`.
5. Buat hash untuk tiap kata sandi dengan `npm run password-hash`. Ketikan kata sandi tidak ditampilkan. Salin keluaran `salt:hash` ke variabel `*_PASSWORD_HASH` yang sesuai; gunakan kata sandi berbeda untuk admin dan owner. Jangan menyimpan kata sandi atau `.env` dalam repositori.
6. Deploy produksi dari `overview/` dengan `vercel --prod`.
7. Pada **Settings → Domains** proyek overview, tambahkan `overview.katalislintasglobal.com`. Buat record DNS **CNAME** bernama `overview` di pengelola DNS domain dengan target persis yang ditampilkan Vercel. Pertahankan konfigurasi DNS dan assignment `katalislintasglobal.com` pada proyek company profile. Jika Vercel meminta verifikasi TXT, tambahkan record yang ditampilkan di sana.
8. Setelah status domain valid dan sertifikat HTTPS aktif, uji login kedua akun. Owner harus mendapat 403 untuk `/api/cycles`, sedangkan admin dapat menyimpan siklus baru. Buka ulang halaman untuk memastikan data tersimpan.

Nilai CNAME bisa spesifik per proyek. Ambil target dari dashboard Vercel, bukan dari contoh umum di dokumentasi.

## Cakupan saat ini

- Owner melihat KPI, grafik per siklus, dan tabel ringkasan; detail tiap ekor, penjualan, biaya, serta formulir siklus hanya tersedia untuk admin.
- Nomor siklus dihasilkan oleh database. Penambahan bersifat permanen; fitur ubah/hapus belum tersedia.
- Bagian dana investor pada dokumen contoh tidak digunakan sampai data operasional dan kebutuhan input dananya disepakati.
- Session login berlaku delapan jam. Mengganti `SESSION_SECRET` mencabut seluruh session yang ada.

Rujukan: [domain Vercel](https://vercel.com/docs/domains/set-up-custom-domain), [konfigurasi build](https://vercel.com/docs/builds/configure-a-build), [Neon di Vercel](https://vercel.com/marketplace/neon/neon).
