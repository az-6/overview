import auth from "../lib/auth.js";
import http from "../lib/http.js";
import db from "../lib/db.js";
import cyclesModel from "../lib/cycles.js";
const { readSession } = auth;
const { json, method, sameOrigin, body } = http;
const { listCycles, addCycle } = db;
const { normalizeCycle } = cyclesModel;

export default async function cycles(req, res) {
  if (!method(req, res, ["GET", "POST"])) return;
  const role = readSession(req);
  if (!role) return json(res, 401, { error: "Silakan masuk." });
  if (role !== "admin") return json(res, 403, { error: "Hanya admin yang dapat membuka data siklus." });
  if (req.method === "GET") {
    try { return json(res, 200, { cycles: await listCycles() }); }
    catch (error) {
      console.error(error);
      return json(res, 503, { error: "Data siklus belum dapat dimuat." });
    }
  }
  if (!sameOrigin(req)) return json(res, 403, { error: "Asal permintaan tidak diizinkan." });
  try {
    const data = normalizeCycle(body(req));
    const no = await addCycle(data);
    json(res, 201, { no });
  } catch (error) {
    if (/DATABASE_URL|connect|fetch|database/i.test(error.message)) {
      console.error(error);
      return json(res, 503, { error: "Basis data belum tersedia." });
    }
    json(res, 400, { error: error.message });
  }
}
