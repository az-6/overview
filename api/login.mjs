import auth from "../lib/auth.js";
import http from "../lib/http.js";
const { credentials, session, cookie } = auth;
const { json, method, sameOrigin, body } = http;

export default async function login(req, res) {
  if (!method(req, res, ["POST"])) return;
  if (!sameOrigin(req)) return json(res, 403, { error: "Asal permintaan tidak diizinkan." });
  try {
    const { username, password } = body(req);
    const role = credentials(username, password);
    if (!role) return json(res, 401, { error: "Nama pengguna atau kata sandi salah." });
    res.setHeader("Set-Cookie", cookie(session(role)));
    json(res, 200, { role });
  } catch (error) {
    if (/Konfigurasi|Hash/.test(error.message)) {
      console.error(error);
      return json(res, 503, { error: "Login belum siap. Hubungi pengelola." });
    }
    json(res, 400, { error: error.message });
  }
}
