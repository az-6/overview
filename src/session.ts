export type Role = 'admin' | 'viewer';
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

const hmacKey = (secret: string) =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function createSession(role: Role, secret: string, now = Date.now()): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ r: role, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS })));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

// Setiap kegagalan (format, tanda tangan, kedaluwarsa, peran) menghasilkan null, tidak pernah galat.
export async function readSession(token: string, secret: string, now = Date.now()): Promise<Role | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return null;

    const data = JSON.parse(decoder.decode(fromBase64Url(payload))) as { r?: unknown; exp?: unknown };
    if (typeof data.exp !== 'number' || data.exp * 1000 <= now) return null;
    return data.r === 'admin' || data.r === 'viewer' ? data.r : null;
  } catch {
    return null;
  }
}
