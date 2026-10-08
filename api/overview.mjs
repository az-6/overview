import auth from "../lib/auth.js";
import http from "../lib/http.js";
import db from "../lib/db.js";
import cycles from "../lib/cycles.js";
const { readSession } = auth;
const { json, method } = http;
const { listCycles } = db;
const { overview } = cycles;

export default async function getOverview(req, res) {
  if (!method(req, res, ["GET"])) return;
  if (!readSession(req)) return json(res, 401, { error: "Silakan masuk." });
  try { json(res, 200, overview(await listCycles())); }
  catch (error) {
    console.error(error);
    json(res, 503, { error: "Data belum dapat dimuat. Periksa koneksi basis data." });
  }
}
