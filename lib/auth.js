const { createHmac, scryptSync, timingSafeEqual } = require("node:crypto");
const COOKIE = "klg_overview_session";
const SESSION_SECONDS = 8 * 60 * 60;

function configured() {
  const keys = ["SESSION_SECRET", "ADMIN_USERNAME", "ADMIN_PASSWORD_HASH", "OWNER_USERNAME", "OWNER_PASSWORD_HASH"];
  if (keys.some((key) => !process.env[key]) || process.env.SESSION_SECRET.length < 32 || process.env.ADMIN_USERNAME === process.env.OWNER_USERNAME) throw new Error("Konfigurasi login belum lengkap.");
}

function passwordMatches(password, stored) {
  const [salt, hex] = String(stored).split(":");
  if (!/^[0-9a-f]{32}$/.test(salt || "") || !/^[0-9a-f]{128}$/.test(hex || "")) throw new Error("Hash kata sandi tidak valid.");
  const expected = Buffer.from(hex, "hex");
  return timingSafeEqual(scryptSync(password, salt, expected.length), expected);
}

function credentials(username, password) {
  configured();
  if (typeof username !== "string" || typeof password !== "string" || password.length > 1024) return null;
  const accounts = [
    { role: "admin", name: process.env.ADMIN_USERNAME, hash: process.env.ADMIN_PASSWORD_HASH },
    { role: "owner", name: process.env.OWNER_USERNAME, hash: process.env.OWNER_PASSWORD_HASH },
  ];
  let role = null;
  for (const account of accounts) {
    const valid = passwordMatches(password, account.hash);
    if (valid && username === account.name) role = account.role;
  }
  return role;
}

function signature(value) {
  return createHmac("sha256", process.env.SESSION_SECRET).update(value).digest("base64url");
}

function session(role) {
  configured();
  if (!["admin", "owner"].includes(role)) throw new Error("Peran tidak valid.");
  const payload = Buffer.from(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

function readSession(req) {
  try {
    configured();
    const cookie = String(req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
    if (!cookie) return null;
    const [payload, mac, extra] = cookie.slice(COOKIE.length + 1).split(".");
    if (!payload || !mac || extra) return null;
    const given = Buffer.from(mac, "base64url");
    const expected = Buffer.from(signature(payload), "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return ["admin", "owner"].includes(data.role) && Number.isSafeInteger(data.exp) && data.exp > Date.now() / 1000 ? data.role : null;
  } catch { return null; }
}

function cookie(value, maxAge = SESSION_SECONDS) {
  return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

module.exports = { credentials, session, readSession, cookie, passwordMatches };
