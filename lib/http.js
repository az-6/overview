function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(data));
}

function method(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader("Allow", allowed.join(", "));
  json(res, 405, { error: "Metode tidak didukung." });
  return false;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const host = req.headers.host;
    const parsed = new URL(origin);
    return parsed.host === host && (parsed.protocol === "https:" || (host?.startsWith("localhost:") && parsed.protocol === "http:"));
  } catch { return false; }
}

function body(req) {
  if (!String(req.headers["content-type"] || "").startsWith("application/json")) throw new Error("Kirim data dalam format JSON.");
  if (Number(req.headers["content-length"] || 0) > 256000) throw new Error("Data terlalu besar.");
  const data = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (!data || typeof data !== "object" || Array.isArray(data) || JSON.stringify(data).length > 256000) throw new Error("Data permintaan tidak valid atau terlalu besar.");
  return data;
}

module.exports = { json, method, sameOrigin, body };
