const H = require("../hitung.js");

function cleanText(value, label, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} wajib berupa teks, maksimal ${max} karakter.`);
  return value.trim();
}

function cleanOptional(value, label, max = 500) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > max) throw new Error(`${label} harus berupa teks, maksimal ${max} karakter.`);
  return value.trim();
}

function list(value, label, limit) {
  if (!Array.isArray(value) || value.length > limit) throw new Error(`${label} harus berupa daftar, maksimal ${limit} entri.`);
  return value;
}

function normalizeCycle(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Siklus tidak valid.");
  const s = {
    produksi: input.produksi,
    kirim: input.kirim || "",
    pembeli: cleanText(input.pembeli, "Pembeli"),
    ekor: list(input.ekor, "Ekor", 500).map((e, i) => ({
      tag: cleanText(e?.tag, `Tag ekor ${i + 1}`, 40),
      kg: e?.kg,
      loinKg: e?.loinKg,
      grade: cleanText(e?.grade, `Grade ekor ${i + 1}`, 40),
    })),
    penjualan: list(input.penjualan, "Penjualan", 100).map((p, i) => ({
      nama: cleanText(p?.nama, `Nama penjualan ${i + 1}`),
      kg: p?.kg,
      harga: p?.harga,
    })),
    biaya: list(input.biaya, "Biaya", 100).map((b, i) => ({
      nama: cleanText(b?.nama, `Nama biaya ${i + 1}`),
      rp: b?.rp,
    })),
    langkah: list(input.langkah, "Langkah", 100).map((l, i) => ({
      judul: cleanText(l?.judul, `Judul langkah ${i + 1}`),
      isi: cleanOptional(l?.isi, `Isi langkah ${i + 1}`),
      status: l?.status,
    })),
  };
  H.periksa([{ ...s, no: 1 }]);
  return s;
}

function overview(daftar) {
  const checked = H.periksa(daftar);
  return {
    total: H.ringkasSemua(checked),
    rows: checked.map((s) => ({
      no: s.no,
      produksi: s.produksi,
      pembeli: s.pembeli,
      summary: H.ringkasSiklus(s),
    })),
  };
}

module.exports = { normalizeCycle, overview };
