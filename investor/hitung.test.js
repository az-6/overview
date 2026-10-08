const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./hitung.js");

globalThis.window = globalThis;
require("./siklus.js");

const ekor = (kg, loinKg, grade = "B") => ({ tag: "x", kg, loinKg, grade });
const dasar = (o = {}) => ({
  no: 1, produksi: "2026-10-03", kirim: "", pembeli: "PT Uji",
  ekor: [ekor(40, 25)], penjualan: [{ nama: "Loin B-SO", kg: 25, harga: 140000 }],
  biaya: [{ nama: "Ikan", rp: 1000000 }], langkah: [], ...o,
});
const pct = (x) => Math.round(x * 1000) / 10;

test("siklus 1 cocok dengan angka laporan", () => {
  const [s] = H.periksa(window.SIKLUS);
  const r = H.ringkasSiklus(s);
  assert.equal(r.pendapatan, 41576150);
  assert.equal(r.biaya, 37072682);
  assert.equal(r.laba, 4503468);
  assert.equal(pct(r.yield), 62.6);
  assert.equal(r.ekor, 11);
});

test("pendapatan dibulatkan per baris", () => {
  const s = dasar({ penjualan: [{ nama: "Loin", kg: 0.5, harga: 3 }, { nama: "Loin", kg: 0.5, harga: 3 }] });
  assert.equal(H.ringkasSiklus(s).pendapatan, 4); // 2 + 2, bukan round(3)
});

test("total lintas siklus tertimbang berat, bukan rata-rata persen", () => {
  const a = dasar({ no: 1, ekor: [ekor(100, 60)] });
  const b = dasar({ no: 2, ekor: [ekor(10, 2)] });
  const t = H.ringkasSemua([a, b]);
  assert.equal(pct(t.yield), 56.4); // 62/110, bukan (60%+20%)/2 = 40%
  assert.equal(t.siklus, 2);
});

test("siklus kosong menghasilkan null, bukan NaN", () => {
  const r = H.ringkasSiklus(dasar({ ekor: [], penjualan: [], biaya: [] }));
  assert.equal(r.yield, null);
  assert.equal(r.margin, null);
  assert.equal(r.hppPerKgLoin, null);
  assert.equal(H.persen(r.yield), "—");
  assert.equal(H.ringkasSemua([]).yield, null);
});

test("data cacat ditolak dengan kalimat", () => {
  assert.throws(() => H.periksa([dasar({ ekor: [ekor(40, 45)] })]), /loin.*lebih besar/);
  assert.throws(() => H.periksa([dasar({ penjualan: [{ nama: "Loin", kg: 1, harga: "140.000" }] })]), /harga.*bilangan bulat/);
  assert.throws(() => H.periksa([dasar({ biaya: [{ nama: "Ikan", rp: 10.5 }] })]), /rp.*bilangan bulat/);
  assert.throws(() => H.periksa([dasar(), dasar()]), /nomor 1.*dua kali/);
  assert.throws(() => H.periksa([dasar({ produksi: "3/10/2026" })]), /tanggal/);
  assert.throws(() => H.periksa([dasar({ langkah: [{ judul: "a", isi: "", status: "nanti" }] })]), /status/);
});

test("format", () => {
  assert.equal(H.rp(4503468), "Rp 4.503.468");
  assert.equal(H.rp(-5061890), "−Rp 5.061.890");
  assert.equal(H.kg(300.94000000000005), "300,94 kg");
  assert.equal(H.persen(0.62566), "62,6 %");
});

test("entri cacat ditolak dengan kalimat, bukan TypeError", () => {
  assert.throws(() => H.periksa([dasar({ penjualan: [{ nama: 5, kg: 1, harga: 1 }] })]), /nama wajib/);
  assert.throws(() => H.periksa([dasar({ pembeli: 7 })]), /pembeli wajib/);
  assert.throws(() => H.periksa([null]), /entri ke-1 kosong/);
  assert.throws(() => H.periksa([dasar({ ekor: [null] })]), /ekor ke-1 kosong/);
  assert.throws(() => H.periksa([dasar({ produksi: "2026-02-30" })]), /tanggal produksi/);
  assert.throws(() => H.periksa([dasar({ kirim: "2026-13-01" })]), /tanggal kirim/);
});
