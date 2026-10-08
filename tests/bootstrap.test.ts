import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/bootstrap';

const good = { ADMIN_PASSWORD: 'admin-password-123', VIEWER_PASSWORD: 'viewer-password-123', SESSION_SECRET: 's'.repeat(32) };

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('buildApp', () => {
  it.each([
    ['tanpa env sama sekali', {}],
    ['sandi admin terlalu pendek', { ...good, ADMIN_PASSWORD: 'pendek' }],
    ['rahasia sesi terlalu pendek', { ...good, SESSION_SECRET: 'x' }],
    ['kedua sandi sama', { ...good, VIEWER_PASSWORD: good.ADMIN_PASSWORD }],
    ['di Vercel tanpa token Blob', { ...good, VERCEL: '1' }],
  ])('menjawab 503 di semua rute: %s', async (_label, env) => {
    const app = buildApp(env);
    for (const [method, path] of [['GET', '/'], ['GET', '/login'], ['POST', '/login'], ['GET', '/robots.txt'], ['GET', '/admin'], ['POST', '/admin/reports']] as const) {
      const res = await app.request(path, { method, headers: { origin: 'http://localhost' } });
      expect(res.status, `${method} ${path}`).toBe(503);
    }
  });

  it('tidak membocorkan nilai env ke respons maupun log', async () => {
    const app = buildApp({ ...good, ADMIN_PASSWORD: 'rahasia-9' });
    const res = await app.request('/login');
    expect(await res.text()).not.toContain('rahasia-9');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('rahasia-9');
  });

  it('log menyebut nama variabel yang bermasalah', () => {
    buildApp({ ...good, SESSION_SECRET: '' });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain('SESSION_SECRET');
  });

  it('berjalan normal dengan konfigurasi lengkap di luar Vercel', async () => {
    const app = buildApp(good);
    expect((await app.request('/login')).status).toBe(200);
  });
});
