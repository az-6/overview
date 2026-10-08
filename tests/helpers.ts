// tests/helpers.ts
import { createApp, type Deps } from '../src/http-app';
import { createLoginLimiter } from '../src/rate-limit';
import { createDanaStore } from '../src/store/dana-store';
import { createMemoryBackend } from '../src/store/memory-backend';
import { createSiklusStore } from '../src/store/siklus-store';

export const ADMIN = 'admin-password-123';
export const OWNER = 'owner-password-123';
export const SECRET = 's'.repeat(32);
export const ORIGIN = 'http://localhost';

export function makeApp(overrides: Partial<Deps> = {}) {
  const backend = createMemoryBackend();
  const siklus = createSiklusStore(backend);
  const dana = createDanaStore(backend);
  const limiter = createLoginLimiter();
  const app = createApp({
    config: { adminPassword: ADMIN, ownerPassword: OWNER, sessionSecret: SECRET },
    siklus,
    dana,
    limiter,
    ...overrides,
  });
  return { app, siklus, dana, limiter, backend };
}

type App = ReturnType<typeof makeApp>['app'];

export async function login(app: App, password: string, headers: Record<string, string> = {}) {
  return app.request('/login', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams({ password }).toString(),
  });
}

export async function sessionCookie(app: App, password: string): Promise<string> {
  const setCookie = (await login(app, password)).headers.get('set-cookie');
  if (!setCookie) throw new Error('login gagal');
  return setCookie.split(';')[0];
}

export const get = (app: App, path: string, cookie?: string) =>
  app.request(path, { headers: cookie ? { cookie } : {} });

export const post = (app: App, path: string, cookie: string, body?: BodyInit, headers: Record<string, string> = {}) =>
  app.request(path, { method: 'POST', body, headers: { origin: ORIGIN, cookie, ...headers } });
