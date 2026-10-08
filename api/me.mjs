import auth from "../lib/auth.js";
import http from "../lib/http.js";
const { readSession } = auth;
const { json, method } = http;

export default function me(req, res) {
  if (!method(req, res, ["GET"])) return;
  const role = readSession(req);
  if (!role) return json(res, 401, { error: "Silakan masuk." });
  json(res, 200, { role });
}
