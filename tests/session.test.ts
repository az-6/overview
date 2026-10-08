import { describe, expect, it } from 'vitest';
import { createSession, readSession, SESSION_TTL_SECONDS } from '../src/session';

const secret = 'a'.repeat(32);
const now = 1_700_000_000_000;
const enc = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('sesi', () => {
  it('membuat dan membaca sesi untuk kedua peran', async () => {
    expect(await readSession(await createSession('admin', secret, now), secret, now)).toBe('admin');
    expect(await readSession(await createSession('viewer', secret, now), secret, now)).toBe('viewer');
  });

  it('kedaluwarsa tepat setelah masa berlaku', async () => {
    const token = await createSession('viewer', secret, now);
    const last = now + SESSION_TTL_SECONDS * 1000 - 1000;
    expect(await readSession(token, secret, last)).toBe('viewer');
    expect(await readSession(token, secret, now + SESSION_TTL_SECONDS * 1000)).toBeNull();
  });

  it('menolak token yang diubah: peran dinaikkan, tanda tangan dipertahankan', async () => {
    const token = await createSession('viewer', secret, now);
    const [, signature] = token.split('.');
    const forged = `${enc({ r: 'admin', exp: Math.floor(now / 1000) + 99999 })}.${signature}`;
    expect(await readSession(forged, secret, now)).toBeNull();
  });

  it('menolak rahasia berbeda dan token rusak', async () => {
    const token = await createSession('admin', secret, now);
    expect(await readSession(token, 'b'.repeat(32), now)).toBeNull();
    for (const bad of ['', 'abc', 'a.b.c', '.', `${token}x`, `x${token}`]) {
      expect(await readSession(bad, secret, now)).toBeNull();
    }
  });

  it('menolak peran yang tidak dikenal walau ditandatangani sah', async () => {
    const token = await createSession('root' as never, secret, now);
    expect(await readSession(token, secret, now)).toBeNull();
  });
});
