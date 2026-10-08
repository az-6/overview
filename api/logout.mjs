import auth from "../lib/auth.js";
import http from "../lib/http.js";
const { cookie } = auth;
const { json, method, sameOrigin } = http;

export default function logout(req, res) {
  if (!method(req, res, ["POST"])) return;
  if (!sameOrigin(req)) return json(res, 403, { error: "Asal permintaan tidak diizinkan." });
  res.setHeader("Set-Cookie", cookie("", 0));
  json(res, 200, { ok: true });
}
