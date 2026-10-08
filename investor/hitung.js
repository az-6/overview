// Satu-satunya tempat rumus laman investor hidup. Murni, tanpa dependensi.
(function (root) {
  const jumlah = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const nilaiBaris = (p) => Math.round(p.kg * p.harga);
  const bagi = (a, b) => (b ? a / b : null);
  const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
  const STATUS = ["selesai", "berjalan"];
  const teks = (t) => typeof t === "string" && t.trim() !== "";
  // Regex saja menerima 2026-02-30; tanggal yang sah harus kembali ke dirinya sendiri.
  const tanggalSah = (d) => {
    const t = new Date(d + "T00:00:00Z");
    return TANGGAL.test(d) && !isNaN(t) && t.toISOString().slice(0, 10) === d;
  };
  const objek = (x) => x !== null && typeof x === "object";

  function periksa(daftar) {
    if (!Array.isArray(daftar)) throw new Error("Data siklus harus berupa daftar (SIKLUS = [...]).");
    const dilihat = new Set();
    for (const [n, s] of daftar.entries()) {
      if (!objek(s)) throw new Error(`Data siklus entri ke-${n + 1} kosong atau bukan objek (cek koma ganda di siklus.js).`);
      const di = `Siklus ${s.no}`;
      const salah = (m) => { throw new Error(`${di}: ${m}`); };
      if (!Number.isInteger(s.no) || s.no < 1) salah("nomor siklus harus bilangan bulat ≥ 1.");
      if (dilihat.has(s.no)) throw new Error(`Siklus nomor ${s.no} tercatat dua kali.`);
      dilihat.add(s.no);
      if (typeof s.produksi !== "string" || !tanggalSah(s.produksi)) salah("tanggal produksi harus tanggal yang ada, berbentuk YYYY-MM-DD.");
      if (s.kirim && (typeof s.kirim !== "string" || !tanggalSah(s.kirim))) salah("tanggal kirim harus tanggal yang ada, berbentuk YYYY-MM-DD, atau kosong.");
      if (!teks(s.pembeli)) salah("pembeli wajib diisi.");
      for (const k of ["ekor", "penjualan", "biaya", "langkah"]) {
        if (!Array.isArray(s[k])) salah(`${k} harus berupa daftar.`);
        s[k].forEach((x, i) => { if (!objek(x)) salah(`${k} ke-${i + 1} kosong atau bukan objek (cek koma ganda).`); });
      }
      s.ekor.forEach((e, i) => {
        const d = `ekor ke-${i + 1} (tag ${e.tag})`;
        if (!(typeof e.kg === "number" && e.kg > 0)) salah(`${d}: kg harus angka positif.`);
        if (!(typeof e.loinKg === "number" && e.loinKg >= 0)) salah(`${d}: kg loin harus angka ≥ 0.`);
        if (e.loinKg > e.kg) salah(`${d}: kg loin ${e.loinKg} lebih besar dari berat ekornya ${e.kg}.`);
        if (!teks(e.grade)) salah(`${d}: grade wajib diisi.`);
      });
      s.penjualan.forEach((p, i) => {
        const d = `penjualan ke-${i + 1} (${p.nama})`;
        if (!teks(p.nama)) salah(`${d}: nama wajib diisi sebagai teks.`);
        if (!(typeof p.kg === "number" && p.kg > 0)) salah(`${d}: kg harus angka positif.`);
        if (!(Number.isInteger(p.harga) && p.harga >= 0)) salah(`${d}: harga harus bilangan bulat rupiah tanpa titik (140000, bukan "140.000").`);
      });
      s.biaya.forEach((b, i) => {
        const d = `biaya ke-${i + 1} (${b.nama})`;
        if (!teks(b.nama)) salah(`${d}: nama wajib diisi sebagai teks.`);
        if (!(Number.isInteger(b.rp) && b.rp >= 0)) salah(`${d}: rp harus bilangan bulat rupiah.`);
      });
      s.langkah.forEach((l, i) => {
        if (!teks(l.judul)) salah(`langkah ke-${i + 1}: judul wajib diisi.`);
        if (!STATUS.includes(l.status)) salah(`langkah ke-${i + 1}: status harus "selesai" atau "berjalan".`);
      });
    }
    return [...daftar].sort((a, b) => a.no - b.no);
  }

  function ringkasSiklus(s) {
    const kgIkan = jumlah(s.ekor, (e) => e.kg);
    const kgLoin = jumlah(s.ekor, (e) => e.loinKg);
    const pendapatan = jumlah(s.penjualan, nilaiBaris);
    const biaya = jumlah(s.biaya, (b) => b.rp);
    const laba = pendapatan - biaya;
    const loin = s.penjualan.filter((p) => p.nama.startsWith("Loin"));
    return {
      ekor: s.ekor.length, kgIkan, kgLoin, pendapatan, biaya, laba,
      yield: bagi(kgLoin, kgIkan),
      margin: bagi(laba, pendapatan),
      hppPerKgLoin: bagi(biaya, kgLoin),
      hargaRataLoin: bagi(jumlah(loin, nilaiBaris), jumlah(loin, (p) => p.kg)),
    };
  }

  function ringkasSemua(daftar) {
    const r = daftar.map(ringkasSiklus);
    const t = (k) => jumlah(r, (x) => x[k]);
    const kgIkan = t("kgIkan"), kgLoin = t("kgLoin"), pendapatan = t("pendapatan"), laba = t("laba");
    return {
      siklus: daftar.length, ekor: t("ekor"), kgIkan, kgLoin, pendapatan, biaya: t("biaya"), laba,
      yield: bagi(kgLoin, kgIkan), margin: bagi(laba, pendapatan),
    };
  }

  const angka = (n, d) => n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
  const rp = (n) => (n < 0 ? "−" : "") + "Rp " + Math.abs(n).toLocaleString("id-ID");
  const ringkas = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 2 });
  const rpRingkas = (n) => (n < 0 ? "−" : "") + "Rp " + ringkas.format(Math.abs(n));
  const kg = (n, d = 2) => angka(n, d) + " kg";
  const persen = (x) => (x == null ? "—" : angka(x * 100, 1) + " %");

  const api = { periksa, ringkasSiklus, ringkasSemua, rp, rpRingkas, kg, persen };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Hitung = api;
})(this);
