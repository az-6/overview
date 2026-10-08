const test = require("node:test");
const assert = require("node:assert/strict");
const { scryptSync } = require("node:crypto");
const auth = require("./lib/auth.js");
const { normalizeCycle, overview } = require("./lib/cycles.js");

const hash = (password, salt) => `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars-long";
process.env.ADMIN_USERNAME = "admin";
process.env.OWNER_USERNAME = "owner";
process.env.ADMIN_PASSWORD_HASH = hash("admin-password", "a".repeat(32));
process.env.OWNER_PASSWORD_HASH = hash("owner-password", "b".repeat(32));

function response() {
  return {
    headers: {}, statusCode: 200, payload: null,
    setHeader(key, value) { this.headers[key] = value; },
    end(body) { this.payload = JSON.parse(body); },
  };
}

test("login, sesi, dan tanda tangan yang diubah", () => {
  assert.equal(auth.credentials("admin", "admin-password"), "admin");
  assert.equal(auth.credentials("owner", "owner-password"), "owner");
  assert.equal(auth.credentials("owner", "wrong-password"), null);
  const signed = auth.session("owner");
  assert.equal(auth.readSession({ headers: { cookie: `x=1; klg_overview_session=${signed}` } }), "owner");
  assert.equal(auth.readSession({ headers: { cookie: `klg_overview_session=${signed}x` } }), null);
});

test("owner tidak dapat membaca atau menulis API siklus", async () => {
  const cyclesApi = (await import("./api/cycles.mjs")).default;
  for (const method of ["GET", "POST"]) {
    const req = { method, headers: { cookie: `klg_overview_session=${auth.session("owner")}` } };
    const res = response();
    await cyclesApi(req, res);
    assert.equal(res.statusCode, 403);
  }
});

test("ringkasan tidak membocorkan detail ikan, penjualan, atau biaya", () => {
  const cycle = normalizeCycle({
    produksi: "2026-10-03", kirim: "", pembeli: "PT Uji",
    ekor: [{ tag: "001", kg: 40, loinKg: 25, grade: "B" }],
    penjualan: [{ nama: "Loin", kg: 25, harga: 140000 }],
    biaya: [{ nama: "Ikan", rp: 1000000 }], langkah: [],
  });
  const data = overview([{ ...cycle, no: 1 }]);
  assert.equal(data.total.siklus, 1);
  assert.equal(data.rows[0].summary.laba, 2500000);
  assert.equal("ekor" in data.rows[0], false);
  assert.equal("penjualan" in data.rows[0], false);
  assert.equal("biaya" in data.rows[0], false);
  assert.throws(() => normalizeCycle({ ...cycle, ekor: [{ tag: "", kg: 40, loinKg: 25, grade: "B" }] }), /Tag/);
});
