# Portal Laporan HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal login dua peran (admin mengunggah dan menghapus, pegawai hanya melihat) untuk laporan HTML, di `overview.katalislintasglobal.com`.

**Architecture:** Aplikasi Hono tanpa JavaScript di browser. `createApp(deps)` menerima konfigurasi, `ReportStore`, dan pembatas login, sehingga semua perilaku diuji lewat `app.request()`. `ReportStore` berdiri di atas `ObjectBackend` (memori untuk tes, berkas untuk lokal, Vercel Blob privat untuk produksi). Laporan ditampilkan di iframe sandbox dan disajikan dengan CSP `sandbox`.

**Tech Stack:** Node >= 22, TypeScript (strict), Hono, `@vercel/blob`, Vitest, tsx, `@hono/node-server`.

**Spec:** `docs/superpowers/specs/2026-10-08-overview-reports-design.md` (baca dulu; spec adalah otoritas bila rencana ini berbeda).

## Global Constraints

- Semua teks antarmuka, pesan galat, dan pesan commit dalam bahasa Indonesia.
- Tidak ada JavaScript di sisi browser pada halaman aplikasi. Hanya form HTML.
- Tidak ada sandi, rahasia, atau nilai env asli di repo, log, atau tes selain nilai uji yang jelas palsu.
- Env var: `ADMIN_PASSWORD` (>= 12 karakter), `VIEWER_PASSWORD` (>= 12), `SESSION_SECRET` (>= 32); kedua sandi harus berbeda. Konfigurasi lemah atau hilang berarti 503 di semua rute, dan log hanya memuat nama variabel.
- Cookie: `__Host-overview_session`, HttpOnly, Secure, SameSite=Strict, Path=/, berlaku 43200 detik (12 jam).
- Batas unggah 4 MB (4194304 byte), judul <= 120 karakter, ekstensi `.html` atau `.htm`, isi UTF-8 valid.
- ID laporan harus cocok `^[A-Za-z0-9_-]{8,32}$` sebelum menyentuh penyimpanan.
- CSP halaman aplikasi dan CSP `/raw/:id` persis seperti spec bagian 6.
- Tidak ada pembuatan project Vercel, Blob store, env var di Vercel, domain, DNS, push, atau deploy dalam rencana ini. Semua itu langkah rilis spec bagian 10, dan menunggu konfirmasi pemilik.
- Perintah shell bergaya Git Bash. Skrip dengan tanda kutip balik ditulis dengan alat Write, bukan heredoc Bash.

## Review Focus

1. **Token sesi diubah** (peran `viewer` diganti `admin`, atau tanda tangan diganti): diperlakukan sebagai tanpa sesi. Tes: Task 2 dan Task 5.
2. **Laporan bermusuhan** (judul `<script>`, isi HTML berskrip): judul ter-escape; `/raw/:id` memuat CSP `sandbox`; iframe ber-`sandbox` tanpa `allow-same-origin`. Tes: Task 5.
3. **ID laporan berisi `../`** atau karakter di luar pola: 404, tidak menyentuh penyimpanan. Tes: Task 4 dan Task 5.
4. **Konfigurasi lemah atau hilang:** setiap rute menjawab 503, tidak ada yang terbuka. Tes: Task 7.
5. **POST lintas situs** dengan cookie admin yang sah (Origin berbeda atau hilang): unggah dan hapus ditolak, tidak ada yang berubah. Tes: Task 6.

---

## Struktur berkas

```
C:\overview
├── package.json, tsconfig.json, vitest.config.ts, .gitignore, .env.example, README.md
├── samples/laporan-contoh.html
├── src/
│   ├── config.ts            loadConfig, ConfigError
│   ├── passwords.ts         safeEqual
│   ├── session.ts           createSession, readSession, SESSION_TTL_SECONDS, Role
│   ├── rate-limit.ts        createLoginLimiter
│   ├── store/
│   │   ├── types.ts         ReportMeta, ObjectBackend, ReportStore
│   │   ├── report-store.ts  createReportStore, isValidReportId
│   │   ├── memory-backend.ts, file-backend.ts, blob-backend.ts
│   │   └── from-env.ts      createStoreFromEnv
│   ├── pages.ts             templat HTML
│   ├── app.ts               createApp
│   ├── bootstrap.ts         buildApp(env)
│   ├── index.ts             titik masuk Vercel
│   └── dev.ts               server lokal
└── tests/ (helpers.ts dan satu berkas tes per modul)
```

---

### Task 1: Kerangka project dan konfigurasi

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.env.example`, `src/config.ts`
- Test: `tests/config.test.ts`

**Interfaces:**
- Produces: `interface Config { adminPassword: string; viewerPassword: string; sessionSecret: string }`; `class ConfigError extends Error { problems: string[] }`; `loadConfig(env: Record<string, string | undefined>): Config` (melempar `ConfigError`).

- [ ] **Step 1: Inisialisasi project**

```bash
cd /c/overview
git init -b main
npm init -y
npm install hono @vercel/blob
npm install -D typescript vitest tsx @hono/node-server @types/node
```

Lalu ganti `package.json` agar memuat:

```json
{
  "name": "overview-reports",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "tsx watch src/dev.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "check": "tsc --noEmit && vitest run"
  }
}
```

(pertahankan blok `dependencies` dan `devDependencies` yang ditulis npm.)

- [ ] **Step 2: Berkas konfigurasi**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src", "tests"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } });
```

`.gitignore`:

```
node_modules/
.data/
.env
.env.*
!.env.example
.vercel/
dist/
```

`.env.example`:

```
# Isi nilai asli hanya di Vercel (Settings -> Environment Variables), jangan di berkas ini.
ADMIN_PASSWORD=
VIEWER_PASSWORD=
SESSION_SECRET=
# Terisi otomatis saat Blob store dihubungkan ke project Vercel.
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Step 3: Tulis tes yang gagal**

```ts
// tests/config.test.ts
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config';

const valid = {
  ADMIN_PASSWORD: 'admin-password-123',
  VIEWER_PASSWORD: 'viewer-password-123',
  SESSION_SECRET: 's'.repeat(32),
};

describe('loadConfig', () => {
  it('membaca konfigurasi yang valid', () => {
    expect(loadConfig(valid)).toEqual({
      adminPassword: valid.ADMIN_PASSWORD,
      viewerPassword: valid.VIEWER_PASSWORD,
      sessionSecret: valid.SESSION_SECRET,
    });
  });

  it.each([
    ['ADMIN_PASSWORD hilang', { ...valid, ADMIN_PASSWORD: undefined }, 'ADMIN_PASSWORD'],
    ['VIEWER_PASSWORD terlalu pendek', { ...valid, VIEWER_PASSWORD: 'pendek' }, 'VIEWER_PASSWORD'],
    ['SESSION_SECRET 31 karakter', { ...valid, SESSION_SECRET: 's'.repeat(31) }, 'SESSION_SECRET'],
    ['SESSION_SECRET kosong', { ...valid, SESSION_SECRET: '' }, 'SESSION_SECRET'],
    ['kedua sandi sama', { ...valid, VIEWER_PASSWORD: valid.ADMIN_PASSWORD }, 'berbeda'],
  ])('menolak: %s', (_label, env, mention) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(mention);
  });

  it('mengumpulkan semua masalah sekaligus dan tidak membocorkan nilai', () => {
    try {
      loadConfig({ ADMIN_PASSWORD: 'rahasia-pendek', VIEWER_PASSWORD: undefined, SESSION_SECRET: 'x' });
      expect.unreachable();
    } catch (error) {
      const config = error as ConfigError;
      expect(config.problems).toHaveLength(3);
      expect(config.message).not.toContain('rahasia-pendek');
    }
  });
});
```

- [ ] **Step 4: Jalankan, harus gagal**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL, modul `../src/config` tidak ditemukan.

- [ ] **Step 5: Implementasi**

```ts
// src/config.ts
export interface Config {
  adminPassword: string;
  viewerPassword: string;
  sessionSecret: string;
}

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Konfigurasi tidak valid: ${problems.join('; ')}`);
    this.name = 'ConfigError';
  }
}

type Env = Record<string, string | undefined>;

// Pesan hanya memuat nama variabel dan aturan, tidak pernah nilainya.
export function loadConfig(env: Env): Config {
  const problems: string[] = [];
  const read = (name: string, minLength: number) => {
    const value = env[name] ?? '';
    if (value.length < minLength) problems.push(`${name} wajib diisi, minimal ${minLength} karakter`);
    return value;
  };

  const adminPassword = read('ADMIN_PASSWORD', 12);
  const viewerPassword = read('VIEWER_PASSWORD', 12);
  const sessionSecret = read('SESSION_SECRET', 32);
  if (adminPassword && adminPassword === viewerPassword) {
    problems.push('ADMIN_PASSWORD dan VIEWER_PASSWORD harus berbeda');
  }

  if (problems.length > 0) throw new ConfigError(problems);
  return { adminPassword, viewerPassword, sessionSecret };
}
```

- [ ] **Step 6: Jalankan, harus lolos**

Run: `npx vitest run tests/config.test.ts && npx tsc --noEmit`
Expected: PASS, tsc tanpa galat.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: kerangka project dan validasi konfigurasi"
```

---

### Task 2: Perbandingan sandi dan sesi

**Files:**
- Create: `src/passwords.ts`, `src/session.ts`
- Test: `tests/passwords.test.ts`, `tests/session.test.ts`

**Interfaces:**
- Produces: `safeEqual(a: string, b: string): Promise<boolean>`; `type Role = 'admin' | 'viewer'`; `SESSION_TTL_SECONDS = 43200`; `createSession(role: Role, secret: string, now?: number): Promise<string>`; `readSession(token: string, secret: string, now?: number): Promise<Role | null>`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/passwords.test.ts
import { expect, it } from 'vitest';
import { safeEqual } from '../src/passwords';

it('membandingkan sandi', async () => {
  expect(await safeEqual('sama-persis', 'sama-persis')).toBe(true);
  expect(await safeEqual('sama-persis', 'sama-persiS')).toBe(false);
  expect(await safeEqual('pendek', 'jauh-lebih-panjang')).toBe(false);
  expect(await safeEqual('', 'x')).toBe(false);
  expect(await safeEqual('', '')).toBe(true);
});
```

```ts
// tests/session.test.ts
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
```

- [ ] **Step 2: Jalankan, harus gagal**

Run: `npx vitest run tests/passwords.test.ts tests/session.test.ts`
Expected: FAIL, modul tidak ditemukan.

- [ ] **Step 3: Implementasi**

```ts
// src/passwords.ts
const encoder = new TextEncoder();

// Membandingkan hash SHA-256 keduanya, sehingga waktu tidak bergantung pada panjang atau isi sandi.
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all(
    [a, b].map(async (value) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))),
  );
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}
```

```ts
// src/session.ts
export type Role = 'admin' | 'viewer';
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromBase64Url(value: string): Uint8Array {
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
```

- [ ] **Step 4: Jalankan, harus lolos**

Run: `npx vitest run tests/passwords.test.ts tests/session.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: perbandingan sandi waktu-konstan dan sesi bertanda tangan"`

---

### Task 3: Pembatas percobaan login

**Files:**
- Create: `src/rate-limit.ts`
- Test: `tests/rate-limit.test.ts`

**Interfaces:**
- Produces: `interface LoginLimiter { isBlocked(key: string): boolean; recordFailure(key: string): void; reset(key: string): void; retryAfterSeconds(key: string): number }`; `createLoginLimiter(options?: { max?: number; windowMs?: number; now?: () => number }): LoginLimiter`. Bawaan: 5 kegagalan, jendela 15 menit sejak kegagalan pertama.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/rate-limit.test.ts
import { expect, it } from 'vitest';
import { createLoginLimiter } from '../src/rate-limit';

const make = () => {
  let t = 0;
  const limiter = createLoginLimiter({ now: () => t });
  return { limiter, advance: (ms: number) => { t += ms; } };
};

it('memblokir pada kegagalan kelima, bukan sebelumnya', () => {
  const { limiter } = make();
  for (let i = 0; i < 4; i += 1) limiter.recordFailure('ip-1');
  expect(limiter.isBlocked('ip-1')).toBe(false);
  limiter.recordFailure('ip-1');
  expect(limiter.isBlocked('ip-1')).toBe(true);
});

it('membuka blokir setelah 15 menit sejak kegagalan pertama', () => {
  const { limiter, advance } = make();
  for (let i = 0; i < 5; i += 1) limiter.recordFailure('ip-1');
  advance(15 * 60_000 - 1);
  expect(limiter.isBlocked('ip-1')).toBe(true);
  expect(limiter.retryAfterSeconds('ip-1')).toBe(1);
  advance(1);
  expect(limiter.isBlocked('ip-1')).toBe(false);
});

it('menghitung per kunci dan reset menghapus hitungan', () => {
  const { limiter } = make();
  for (let i = 0; i < 5; i += 1) limiter.recordFailure('ip-1');
  expect(limiter.isBlocked('ip-2')).toBe(false);
  limiter.reset('ip-1');
  expect(limiter.isBlocked('ip-1')).toBe(false);
});

it('tidak menumpuk memori tanpa batas', () => {
  const { limiter, advance } = make();
  for (let i = 0; i < 1500; i += 1) limiter.recordFailure(`ip-${i}`);
  advance(16 * 60_000);
  limiter.recordFailure('baru');
  expect(limiter.isBlocked('ip-0')).toBe(false);
});
```

- [ ] **Step 2: Jalankan, harus gagal** — `npx vitest run tests/rate-limit.test.ts` → FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi**

```ts
// src/rate-limit.ts
export interface LoginLimiter {
  isBlocked(key: string): boolean;
  recordFailure(key: string): void;
  reset(key: string): void;
  retryAfterSeconds(key: string): number;
}

interface Options {
  max?: number;
  windowMs?: number;
  now?: () => number;
}

const PRUNE_THRESHOLD = 1000;

// Disimpan di memori instance: best effort. Perlindungan utama tetap panjang sandi dan aturan Firewall.
export function createLoginLimiter({ max = 5, windowMs = 15 * 60_000, now = Date.now }: Options = {}): LoginLimiter {
  const entries = new Map<string, { count: number; start: number }>();

  const live = (key: string) => {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (now() - entry.start >= windowMs) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };

  const prune = () => {
    for (const key of [...entries.keys()]) live(key);
  };

  return {
    isBlocked: (key) => (live(key)?.count ?? 0) >= max,
    recordFailure(key) {
      if (entries.size > PRUNE_THRESHOLD) prune();
      const entry = live(key);
      if (entry) entry.count += 1;
      else entries.set(key, { count: 1, start: now() });
    },
    reset: (key) => void entries.delete(key),
    retryAfterSeconds(key) {
      const entry = live(key);
      return entry ? Math.max(1, Math.ceil((entry.start + windowMs - now()) / 1000)) : 0;
    },
  };
}
```

- [ ] **Step 4: Jalankan, harus lolos** — `npx vitest run tests/rate-limit.test.ts && npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: pembatas percobaan login per IP"`

---

### Task 4: Penyimpanan laporan

**Files:**
- Create: `src/store/types.ts`, `src/store/report-store.ts`, `src/store/memory-backend.ts`, `src/store/file-backend.ts`
- Test: `tests/report-store.test.ts`, `tests/file-backend.test.ts`

**Interfaces:**
- Produces:
  - `interface ReportMeta { id: string; title: string; uploadedAt: string; size: number }`
  - `interface ObjectBackend { read(path: string): Promise<string | null>; write(path: string, body: string): Promise<void>; remove(path: string): Promise<void> }`
  - `interface ReportStore { list(): Promise<ReportMeta[]>; get(id: string): Promise<{ meta: ReportMeta; html: string } | null>; add(input: { title: string; html: string }): Promise<ReportMeta>; remove(id: string): Promise<boolean> }`
  - `isValidReportId(id: string): boolean`; `createReportStore(backend: ObjectBackend, options?: { newId?: () => string; now?: () => Date }): ReportStore`
  - `createMemoryBackend(): ObjectBackend & { files: Map<string, string> }`; `createFileBackend(root: string): ObjectBackend`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/report-store.test.ts
import { describe, expect, it } from 'vitest';
import { createMemoryBackend } from '../src/store/memory-backend';
import { createReportStore, isValidReportId } from '../src/store/report-store';
import type { ObjectBackend } from '../src/store/types';

const make = () => {
  const backend = createMemoryBackend();
  let n = 0;
  let t = Date.parse('2026-10-08T00:00:00Z');
  const store = createReportStore(backend, {
    newId: () => `laporan-${String(++n).padStart(4, '0')}`,
    now: () => new Date((t += 60_000)),
  });
  return { backend, store };
};

describe('ReportStore', () => {
  it('menambah laporan dan menampilkan yang terbaru lebih dulu', async () => {
    const { store } = make();
    await store.add({ title: 'Pertama', html: '<p>satu</p>' });
    const second = await store.add({ title: 'Kedua', html: '<p>dua</p>' });
    expect((await store.list()).map((item) => item.title)).toEqual(['Kedua', 'Pertama']);
    expect(second).toMatchObject({ id: 'laporan-0002', title: 'Kedua', size: 10 });
    expect(await store.get('laporan-0002')).toEqual({ meta: second, html: '<p>dua</p>' });
  });

  it('menghitung ukuran dalam byte, bukan karakter', async () => {
    const { store } = make();
    expect((await store.add({ title: 'x', html: 'é' })).size).toBe(2);
  });

  it('menghapus laporan dan menolak ID yang tidak ada', async () => {
    const { store, backend } = make();
    const meta = await store.add({ title: 'Hapus', html: '<p>x</p>' });
    expect(await store.remove(meta.id)).toBe(true);
    expect(await store.list()).toEqual([]);
    expect(backend.files.has(`reports/${meta.id}.html`)).toBe(false);
    expect(await store.remove(meta.id)).toBe(false);
    expect(await store.get(meta.id)).toBeNull();
  });

  it.each(['../index', '..%2Findex', 'a/b', 'pendek', 'x'.repeat(33), 'spasi di sini', ''])(
    'menolak ID tidak valid %j tanpa menyentuh backend',
    async (id) => {
      const reads: string[] = [];
      const spy: ObjectBackend = {
        read: async (path) => (reads.push(path), null),
        write: async () => {},
        remove: async () => {},
      };
      const store = createReportStore(spy);
      expect(isValidReportId(id)).toBe(false);
      expect(await store.get(id)).toBeNull();
      expect(await store.remove(id)).toBe(false);
      expect(reads).toEqual([]);
    },
  );

  it('menulis HTML sebelum indeks: kegagalan tengah tidak meninggalkan entri tanpa isi', async () => {
    const backend = createMemoryBackend();
    const failing: ObjectBackend = {
      ...backend,
      write: async (path, body) => {
        if (path === 'reports/index.json') throw new Error('Blob gagal');
        await backend.write(path, body);
      },
    };
    const store = createReportStore(failing, { newId: () => 'laporan-0001' });
    await expect(store.add({ title: 'Gagal', html: '<p>x</p>' })).rejects.toThrow('Blob gagal');
    expect(await store.list()).toEqual([]);
  });

  it('menghapus dari indeks sebelum berkas: kegagalan hapus berkas tidak menampilkan entri tanpa isi', async () => {
    const backend = createMemoryBackend();
    const store = createReportStore(
      { ...backend, remove: async () => { throw new Error('hapus gagal'); } },
      { newId: () => 'laporan-0001' },
    );
    const meta = await store.add({ title: 'A', html: '<p>x</p>' });
    await expect(store.remove(meta.id)).rejects.toThrow('hapus gagal');
    expect(await store.list()).toEqual([]);
  });

  it('melaporkan indeks yang rusak sebagai galat, bukan daftar kosong', async () => {
    const backend = createMemoryBackend();
    await backend.write('reports/index.json', '{bukan json');
    await expect(createReportStore(backend).list()).rejects.toThrow();
    await backend.write('reports/index.json', '{"a":1}');
    await expect(createReportStore(backend).list()).rejects.toThrow('Indeks laporan rusak');
  });
});
```

```ts
// tests/file-backend.test.ts
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createFileBackend } from '../src/store/file-backend';

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'overview-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

it('menulis, membaca, dan menghapus', async () => {
  const backend = createFileBackend(root);
  expect(await backend.read('reports/a.html')).toBeNull();
  await backend.write('reports/a.html', '<p>é</p>');
  expect(await backend.read('reports/a.html')).toBe('<p>é</p>');
  await backend.remove('reports/a.html');
  expect(await backend.read('reports/a.html')).toBeNull();
  await expect(backend.remove('reports/a.html')).resolves.toBeUndefined();
});

it('menolak path di luar folder data', async () => {
  const backend = createFileBackend(root);
  await expect(backend.read('../rahasia.txt')).rejects.toThrow('luar folder');
  await expect(backend.write('../../x', 'x')).rejects.toThrow('luar folder');
});
```

- [ ] **Step 2: Jalankan, harus gagal** — `npx vitest run tests/report-store.test.ts tests/file-backend.test.ts` → FAIL.

- [ ] **Step 3: Implementasi**

```ts
// src/store/types.ts
export interface ReportMeta {
  id: string;
  title: string;
  uploadedAt: string;
  size: number;
}

export interface ObjectBackend {
  read(path: string): Promise<string | null>;
  write(path: string, body: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface ReportStore {
  list(): Promise<ReportMeta[]>;
  get(id: string): Promise<{ meta: ReportMeta; html: string } | null>;
  add(input: { title: string; html: string }): Promise<ReportMeta>;
  remove(id: string): Promise<boolean>;
}
```

```ts
// src/store/memory-backend.ts
import type { ObjectBackend } from './types';

export function createMemoryBackend(): ObjectBackend & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    read: async (path) => files.get(path) ?? null,
    write: async (path, body) => void files.set(path, body),
    remove: async (path) => void files.delete(path),
  };
}
```

```ts
// src/store/file-backend.ts
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { ObjectBackend } from './types';

export function createFileBackend(root: string): ObjectBackend {
  const base = resolve(root);
  const target = (path: string) => {
    const full = resolve(base, path);
    if (!full.startsWith(base + sep)) throw new Error('Path di luar folder data');
    return full;
  };

  return {
    async read(path) {
      try {
        return await readFile(target(path), 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    async write(path, body) {
      const full = target(path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, body, 'utf8');
    },
    async remove(path) {
      await rm(target(path), { force: true });
    },
  };
}
```

```ts
// src/store/report-store.ts
import type { ObjectBackend, ReportMeta, ReportStore } from './types';

const ID_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;
const INDEX_PATH = 'reports/index.json';
const htmlPath = (id: string) => `reports/${id}.html`;

export const isValidReportId = (id: string) => ID_PATTERN.test(id);

interface Options {
  newId?: () => string;
  now?: () => Date;
}

export function createReportStore(backend: ObjectBackend, options: Options = {}): ReportStore {
  const newId = options.newId ?? (() => crypto.randomUUID().replaceAll('-', '').slice(0, 12));
  const now = options.now ?? (() => new Date());

  const readIndex = async (): Promise<ReportMeta[]> => {
    const raw = await backend.read(INDEX_PATH);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Indeks laporan rusak');
    return parsed as ReportMeta[];
  };
  const writeIndex = (index: ReportMeta[]) => backend.write(INDEX_PATH, JSON.stringify(index));

  return {
    list: readIndex,

    async get(id) {
      if (!isValidReportId(id)) return null;
      const meta = (await readIndex()).find((item) => item.id === id);
      if (!meta) return null;
      const html = await backend.read(htmlPath(id));
      return html === null ? null : { meta, html };
    },

    // HTML ditulis lebih dulu: kegagalan di tengah hanya meninggalkan berkas yatim.
    async add({ title, html }) {
      const meta: ReportMeta = {
        id: newId(),
        title,
        uploadedAt: now().toISOString(),
        size: new TextEncoder().encode(html).length,
      };
      await backend.write(htmlPath(meta.id), html);
      await writeIndex([meta, ...(await readIndex())]);
      return meta;
    },

    // Indeks ditulis lebih dulu: tidak pernah ada entri tanpa isi.
    async remove(id) {
      if (!isValidReportId(id)) return false;
      const index = await readIndex();
      if (!index.some((item) => item.id === id)) return false;
      await writeIndex(index.filter((item) => item.id !== id));
      await backend.remove(htmlPath(id));
      return true;
    },
  };
}
```

- [ ] **Step 4: Jalankan, harus lolos** — `npx vitest run && npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: penyimpanan laporan di atas backend objek"`

---

### Task 5: Halaman dan aplikasi (login, daftar, viewer, raw)

**Files:**
- Create: `src/pages.ts`, `src/app.ts`, `tests/helpers.ts`
- Test: `tests/app.test.ts`

**Interfaces:**
- Consumes: `Config`, `ReportStore`, `LoginLimiter`, `createSession/readSession`, `safeEqual`, `isValidReportId` (Task 1–4).
- Produces: `interface Deps { config: Config; store: ReportStore; limiter: LoginLimiter; now?: () => number }`; `createApp(deps: Deps): Hono`. Halaman dan rute admin dilengkapi di Task 6; Task ini sudah mendaftarkan `/admin*` sebagai khusus admin dengan isi sementara yang diganti di Task 6.
- Produces (pages): `messagePage(title: string, text: string)`, `loginPage(error?: string)`, `listPage(input: { reports: ReportMeta[]; isAdmin: boolean })`, `viewerPage(meta: ReportMeta)`, `adminPage(input: { reports: ReportMeta[]; message?: string; error?: string })`.

- [ ] **Step 1: Pembantu tes**

```ts
// tests/helpers.ts
import { createApp, type Deps } from '../src/app';
import { createLoginLimiter } from '../src/rate-limit';
import { createMemoryBackend } from '../src/store/memory-backend';
import { createReportStore } from '../src/store/report-store';

export const ADMIN = 'admin-password-123';
export const VIEWER = 'viewer-password-123';
export const SECRET = 's'.repeat(32);
export const ORIGIN = 'http://localhost';

export function makeApp(overrides: Partial<Deps> = {}) {
  const store = createReportStore(createMemoryBackend());
  const limiter = createLoginLimiter();
  const app = createApp({
    config: { adminPassword: ADMIN, viewerPassword: VIEWER, sessionSecret: SECRET },
    store,
    limiter,
    ...overrides,
  });
  return { app, store, limiter };
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
```

- [ ] **Step 2: Tulis tes yang gagal**

```ts
// tests/app.test.ts
import { describe, expect, it } from 'vitest';
import { createSession } from '../src/session';
import { ADMIN, get, login, makeApp, ORIGIN, post, SECRET, sessionCookie, VIEWER } from './helpers';

const hostile = '<script>fetch("/admin")</script><p>isi laporan</p>';

describe('login', () => {
  it('menampilkan form dan memberi cookie dengan atribut yang benar', async () => {
    const { app } = makeApp();
    expect((await get(app, '/login')).status).toBe(200);

    const res = await login(app, VIEWER);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/');
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^__Host-overview_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=43200/);
  });

  it('menolak sandi salah dengan pesan generik dan tanpa cookie', async () => {
    const { app } = makeApp();
    const res = await login(app, 'salah');
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await res.text()).toContain('Sandi salah');
  });

  it('memblokir setelah 5 kegagalan dari IP yang sama, termasuk untuk sandi benar', async () => {
    const { app } = makeApp();
    const ip = { 'x-forwarded-for': '203.0.113.9' };
    for (let i = 0; i < 5; i += 1) expect((await login(app, 'salah', ip)).status).toBe(401);
    const blocked = await login(app, ADMIN, ip);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect((await login(app, ADMIN, { 'x-forwarded-for': '203.0.113.10' })).status).toBe(303);
  });

  it('logout menghapus sesi', async () => {
    const { app } = makeApp();
    const cookie = await sessionCookie(app, VIEWER);
    const res = await post(app, '/logout', cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0|Expires=/i);
  });
});

describe('akses tanpa sesi', () => {
  it.each(['/', '/r/laporan-0001', '/raw/laporan-0001', '/admin'])('GET %s dialihkan ke /login', async (path) => {
    const { app } = makeApp();
    const res = await get(app, path);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/login');
  });

  it('robots.txt publik dan melarang semua', async () => {
    const { app } = makeApp();
    const res = await get(app, '/robots.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Disallow: /');
  });

  it('token yang diubah dianggap tanpa sesi', async () => {
    const { app } = makeApp();
    const viewer = await sessionCookie(app, VIEWER);
    const [, signature] = viewer.split('=')[1].split('.');
    const payload = btoa(JSON.stringify({ r: 'admin', exp: 9_999_999_999 })).replace(/=+$/, '');
    const forged = `__Host-overview_session=${payload}.${signature}`;
    expect((await get(app, '/admin', forged)).status).toBe(303);
  });

  it('sesi kedaluwarsa dan sesi bertanda tangan rahasia lain ditolak', async () => {
    let t = 1_700_000_000_000;
    const { app } = makeApp({ now: () => t });
    const cookie = await sessionCookie(app, VIEWER);
    expect((await get(app, '/', cookie)).status).toBe(200);
    t += 13 * 3600 * 1000;
    expect((await get(app, '/', cookie)).status).toBe(303);

    const foreign = `__Host-overview_session=${await createSession('admin', 'x'.repeat(32), t)}`;
    expect((await get(app, '/', foreign)).status).toBe(303);
  });
});

describe('daftar, viewer, dan raw', () => {
  it('daftar menampilkan judul ter-escape dan tidak menampilkan tombol admin untuk pegawai', async () => {
    const { app, store } = makeApp();
    await store.add({ title: '<script>alert(1)</script>', html: '<p>x</p>' });
    const body = await (await get(app, '/', await sessionCookie(app, VIEWER))).text();
    expect(body).not.toContain('<script>alert(1)</script>');
    expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body).not.toContain('/admin');
  });

  it('admin melihat tautan ke halaman admin', async () => {
    const { app } = makeApp();
    expect(await (await get(app, '/', await sessionCookie(app, ADMIN))).text()).toContain('href="/admin"');
  });

  it('viewer memuat iframe ber-sandbox tanpa allow-same-origin', async () => {
    const { app, store } = makeApp();
    const meta = await store.add({ title: 'Laporan', html: hostile });
    const res = await get(app, `/r/${meta.id}`, await sessionCookie(app, VIEWER));
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toMatch(new RegExp(`<iframe[^>]*src="/raw/${meta.id}"`));
    expect(body).toMatch(/<iframe[^>]*sandbox="allow-scripts"/);
    expect(body).not.toMatch(/allow-same-origin/);
    expect(body).not.toContain('fetch("/admin")');
  });

  it('raw mengirim HTML apa adanya dengan CSP sandbox dan tanpa cache', async () => {
    const { app, store } = makeApp();
    const meta = await store.add({ title: 'Laporan', html: hostile });
    const res = await get(app, `/raw/${meta.id}`, await sessionCookie(app, VIEWER));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(hostile);
    const csp = res.headers.get('content-security-policy')!;
    expect(csp).toMatch(/^sandbox allow-scripts;/);
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain('allow-same-origin');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
  });

  it.each(['/r/', '/raw/'])('%s dengan ID tidak valid atau tidak ada menghasilkan 404', async (prefix) => {
    const { app } = makeApp();
    const cookie = await sessionCookie(app, VIEWER);
    for (const id of ['tidak-ada-1', '..%2Findex', '%2e%2e%2findex.json', 'a'.repeat(40)]) {
      expect((await get(app, `${prefix}${id}`, cookie)).status).toBe(404);
    }
  });

  it('semua respons membawa header keamanan, halaman aplikasi memakai CSP ketat', async () => {
    const { app } = makeApp();
    const cookie = await sessionCookie(app, VIEWER);
    for (const res of [await get(app, '/login'), await get(app, '/', cookie), await get(app, '/tidak-ada', cookie)]) {
      expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('strict-transport-security')).toMatch(/max-age=/);
    }
    const csp = (await get(app, '/', cookie)).headers.get('content-security-policy')!;
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'self'");
  });

  it('POST /login dari origin lain ditolak sebelum memeriksa sandi', async () => {
    const { app } = makeApp();
    const res = await app.request('/login', {
      method: 'POST',
      headers: { origin: 'https://situs-lain.example', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: ADMIN }).toString(),
    });
    expect(res.status).toBe(403);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('pegawai mendapat 403 di rute admin', async () => {
    const { app } = makeApp();
    const cookie = await sessionCookie(app, VIEWER);
    expect((await get(app, '/admin', cookie)).status).toBe(403);
    expect(ORIGIN).toBe('http://localhost');
    expect(SECRET).toHaveLength(32);
  });
});
```

- [ ] **Step 3: Jalankan, harus gagal** — `npx vitest run tests/app.test.ts` → FAIL (modul `../src/app` tidak ada).

- [ ] **Step 4: Implementasi halaman**

```ts
// src/pages.ts
import { html } from 'hono/html';
import type { ReportMeta } from './store/types';

const dateFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

const styles = `
  :root { color-scheme: light; font-family: system-ui, sans-serif; color: #101820; }
  body { margin: 0; background: #f5fbfd; }
  main { max-width: 52rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
  h1 { font-size: 1.5rem; margin: 0 0 1rem; }
  header.bar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 2rem; }
  header.bar nav { display: flex; gap: 1rem; align-items: center; }
  a { color: #056988; }
  button, input[type=submit] { font: inherit; padding: .6rem 1rem; border: 0; border-radius: .5rem; background: #061a2f; color: #fff; cursor: pointer; }
  button.link { background: none; color: #056988; padding: 0; text-decoration: underline; }
  label { display: grid; gap: .35rem; margin-bottom: 1rem; font-weight: 600; }
  input[type=password], input[type=text], input[type=file] { font: inherit; padding: .6rem; border: 1px solid #d7e2e8; border-radius: .5rem; background: #fff; }
  ul.reports { list-style: none; padding: 0; margin: 0; display: grid; gap: .75rem; }
  ul.reports li { background: #fff; border: 1px solid #d7e2e8; border-radius: .75rem; padding: 1rem; display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
  small { color: #52616e; display: block; }
  .error { color: #9b1c1c; } .ok { color: #14785f; }
  iframe { width: 100%; height: 85vh; border: 1px solid #d7e2e8; border-radius: .5rem; background: #fff; }
`;

const layout = (title: string, body: unknown) => html`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} · Overview</title>
<style>${styles}</style>
</head>
<body><main>${body}</main></body>
</html>`;

const logoutForm = html`<form method="post" action="/logout"><button class="link" type="submit">Keluar</button></form>`;

export const messagePage = (title: string, text: string) =>
  layout(title, html`<h1>${title}</h1><p>${text}</p><p><a href="/">Kembali</a></p>`);

export const loginPage = (error?: string) =>
  layout('Masuk', html`
    <h1>Masuk</h1>
    ${error ? html`<p class="error" role="alert">${error}</p>` : ''}
    <form method="post" action="/login">
      <label>Sandi
        <input type="password" name="password" autocomplete="current-password" maxlength="200" required autofocus>
      </label>
      <button type="submit">Masuk</button>
    </form>`);

export const listPage = ({ reports, isAdmin }: { reports: ReportMeta[]; isAdmin: boolean }) =>
  layout('Laporan', html`
    <header class="bar"><h1>Laporan</h1><nav>${isAdmin ? html`<a href="/admin">Kelola</a>` : ''}${logoutForm}</nav></header>
    ${reports.length === 0
      ? html`<p>Belum ada laporan.</p>`
      : html`<ul class="reports">${reports.map((report) => html`
          <li><span><a href="/r/${report.id}">${report.title}</a><small>${formatDate(report.uploadedAt)}</small></span></li>`)}</ul>`}`);

export const viewerPage = (meta: ReportMeta) =>
  layout(meta.title, html`
    <header class="bar"><h1>${meta.title}</h1><nav><a href="/">Semua laporan</a>${logoutForm}</nav></header>
    <iframe src="/raw/${meta.id}" sandbox="allow-scripts" referrerpolicy="no-referrer" title="${meta.title}"></iframe>`);

export const adminPage = ({ reports, message, error }: { reports: ReportMeta[]; message?: string; error?: string }) =>
  layout('Kelola laporan', html`
    <header class="bar"><h1>Kelola laporan</h1><nav><a href="/">Daftar</a>${logoutForm}</nav></header>
    ${message ? html`<p class="ok" role="status">${message}</p>` : ''}
    ${error ? html`<p class="error" role="alert">${error}</p>` : ''}
    <form method="post" action="/admin/reports" enctype="multipart/form-data">
      <label>Judul laporan <input type="text" name="title" maxlength="120" required></label>
      <label>Berkas HTML (maksimal 4 MB) <input type="file" name="file" accept=".html,.htm,text/html" required></label>
      <button type="submit">Unggah</button>
    </form>
    <h2>Laporan tersimpan</h2>
    ${reports.length === 0
      ? html`<p>Belum ada laporan.</p>`
      : html`<ul class="reports">${reports.map((report) => html`
          <li>
            <span><a href="/r/${report.id}">${report.title}</a><small>${formatDate(report.uploadedAt)}</small></span>
            <form method="post" action="/admin/reports/${report.id}/delete"><button type="submit">Hapus</button></form>
          </li>`)}</ul>`}`);
```

- [ ] **Step 5: Implementasi aplikasi** (rute admin diisi penuh di Task 6; di sini hanya penjaga dan halaman admin awal)

```ts
// src/app.ts
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Config } from './config';
import { adminPage, listPage, loginPage, messagePage, viewerPage } from './pages';
import { safeEqual } from './passwords';
import type { LoginLimiter } from './rate-limit';
import { createSession, readSession, SESSION_TTL_SECONDS, type Role } from './session';
import { isValidReportId } from './store/report-store';
import type { ReportStore } from './store/types';

export interface Deps {
  config: Config;
  store: ReportStore;
  limiter: LoginLimiter;
  now?: () => number;
}

type AppEnv = { Variables: { role: Role | null } };
type AppContext = Context<AppEnv>;

const COOKIE = 'overview_session';
const APP_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-src 'self'; base-uri 'none'; frame-ancestors 'none'";
const RAW_CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'";

const clientKey = (headers: Headers) =>
  headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
  headers.get('x-forwarded-for')?.split(',')[0].trim() ||
  'unknown';

export function createApp({ config, store, limiter, now = Date.now }: Deps) {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Strict-Transport-Security', 'max-age=31536000');
    c.header('Content-Security-Policy', APP_CSP);
    await next();
  });

  // Semua metode selain GET/HEAD harus berasal dari origin yang sama; header hilang berarti ditolak.
  app.use('*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.header('origin') !== new URL(c.req.url).origin) {
      return c.html(messagePage('Ditolak', 'Permintaan tidak berasal dari situs ini.'), 403);
    }
    await next();
  });

  app.use('*', async (c, next) => {
    const token = getCookie(c, COOKIE, 'host');
    c.set('role', token ? await readSession(token, config.sessionSecret, now()) : null);
    await next();
  });

  app.get('/robots.txt', (c) => c.text('User-agent: *\nDisallow: /\n'));

  app.get('/login', (c) => (c.get('role') ? c.redirect('/', 303) : c.html(loginPage())));

  app.post('/login', async (c) => {
    const key = clientKey(c.req.raw.headers);
    if (limiter.isBlocked(key)) {
      const wait = limiter.retryAfterSeconds(key);
      c.header('Retry-After', String(wait));
      return c.html(messagePage('Terlalu banyak percobaan', `Coba lagi dalam ${Math.ceil(wait / 60)} menit.`), 429);
    }

    const body = await c.req.parseBody();
    const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
    // Kedua perbandingan selalu dijalankan agar waktu tidak membedakan peran.
    const [isAdmin, isViewer] = await Promise.all([
      safeEqual(password, config.adminPassword),
      safeEqual(password, config.viewerPassword),
    ]);
    const role: Role | null = isAdmin ? 'admin' : isViewer ? 'viewer' : null;

    if (!role) {
      limiter.recordFailure(key);
      return c.html(loginPage('Sandi salah.'), 401);
    }
    limiter.reset(key);
    setCookie(c, COOKIE, await createSession(role, config.sessionSecret, now()), {
      prefix: 'host',
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return c.redirect('/', 303);
  });

  // Semua rute di bawah ini membutuhkan sesi.
  app.use('*', async (c, next) => {
    if (c.get('role')) return next();
    if (c.req.method === 'GET' || c.req.method === 'HEAD') return c.redirect('/login', 303);
    return c.html(messagePage('Perlu login', 'Silakan login terlebih dahulu.'), 401);
  });

  const adminOnly = async (c: AppContext, next: () => Promise<void>) =>
    c.get('role') === 'admin'
      ? next()
      : c.html(messagePage('Akses ditolak', 'Halaman ini hanya untuk admin.'), 403);
  app.use('/admin', adminOnly);
  app.use('/admin/*', adminOnly);

  app.post('/logout', (c) => {
    deleteCookie(c, COOKIE, { prefix: 'host', path: '/', secure: true });
    return c.redirect('/login', 303);
  });

  app.get('/', async (c) => c.html(listPage({ reports: await store.list(), isAdmin: c.get('role') === 'admin' })));

  const notFound = (c: AppContext) => c.html(messagePage('Tidak ditemukan', 'Laporan tidak ada.'), 404);

  app.get('/r/:id', async (c) => {
    const id = c.req.param('id');
    const found = isValidReportId(id) ? await store.get(id) : null;
    return found ? c.html(viewerPage(found.meta)) : notFound(c);
  });

  app.get('/raw/:id', async (c) => {
    const id = c.req.param('id');
    const found = isValidReportId(id) ? await store.get(id) : null;
    if (!found) return notFound(c);
    c.header('Content-Security-Policy', RAW_CSP);
    return c.body(found.html, 200, { 'Content-Type': 'text/html; charset=utf-8' });
  });

  // Diganti dengan rute unggah dan hapus di Task 6.
  app.get('/admin', async (c) => c.html(adminPage({ reports: await store.list() })));

  app.notFound((c) => c.html(messagePage('Tidak ditemukan', 'Halaman tidak ada.'), 404));
  app.onError((error, c) => {
    console.error(error);
    return c.html(messagePage('Terjadi kesalahan', 'Coba lagi sebentar lagi.'), 500);
  });

  return app;
}
```

- [ ] **Step 6: Jalankan, harus lolos**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS. Bila ada tes yang gagal karena perilaku Hono (mis. nama atribut cookie, header yang tertimpa), perbaiki kode, bukan melemahkan tes; tes menyatakan perilaku yang diwajibkan spec.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: login, daftar, penampil, dan penyajian laporan ber-sandbox"`

---

### Task 6: Unggah dan hapus laporan (admin)

**Files:**
- Modify: `src/app.ts` (ganti rute `GET /admin` sementara)
- Test: `tests/admin.test.ts`

**Interfaces:**
- Consumes: `adminPage`, `store`, rute penjaga dari Task 5.
- Produces: `GET /admin` (menerima `?added=1` dan `?removed=1`), `POST /admin/reports`, `POST /admin/reports/:id/delete`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/admin.test.ts
import { describe, expect, it } from 'vitest';
import { ADMIN, get, makeApp, post, sessionCookie, VIEWER } from './helpers';

const form = (fields: { title?: string; name?: string; content?: BlobPart }) => {
  const data = new FormData();
  if (fields.title !== undefined) data.set('title', fields.title);
  if (fields.name !== undefined) data.set('file', new File([fields.content ?? '<p>isi</p>'], fields.name, { type: 'text/html' }));
  return data;
};

describe('unggah', () => {
  it('admin mengunggah laporan lalu laporan muncul di daftar dan dapat dibuka pegawai', async () => {
    const { app, store } = makeApp();
    const admin = await sessionCookie(app, ADMIN);
    const res = await post(app, '/admin/reports', admin, form({ title: '  Laporan Oktober  ', name: 'oktober.html', content: '<h1>Okt</h1>' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin?added=1');

    const [meta] = await store.list();
    expect(meta.title).toBe('Laporan Oktober');
    expect((await store.get(meta.id))?.html).toBe('<h1>Okt</h1>');

    const viewer = await sessionCookie(app, VIEWER);
    expect(await (await get(app, '/', viewer)).text()).toContain('Laporan Oktober');
    expect(await (await get(app, `/raw/${meta.id}`, viewer)).text()).toBe('<h1>Okt</h1>');
    expect(await (await get(app, '/admin?added=1', admin)).text()).toContain('Laporan ditambahkan');
  });

  it.each([
    ['judul kosong', form({ title: '   ', name: 'a.html' }), 400, 'Judul'],
    ['judul 121 karakter', form({ title: 'x'.repeat(121), name: 'a.html' }), 400, 'Judul'],
    ['tanpa berkas', form({ title: 'A' }), 400, 'Pilih berkas'],
    ['berkas kosong', form({ title: 'A', name: 'a.html', content: '' }), 400, 'Pilih berkas'],
    ['ekstensi salah', form({ title: 'A', name: 'a.pdf' }), 400, '.html'],
    ['bukan UTF-8', form({ title: 'A', name: 'a.html', content: new Uint8Array([0xff, 0xfe, 0xfa]) }), 400, 'UTF-8'],
    ['5 MB', form({ title: 'A', name: 'a.html', content: 'x'.repeat(5 * 1024 * 1024) }), 413, '4 MB'],
  ])('menolak %s dan tidak menyimpan apa pun', async (_label, body, status, message) => {
    const { app, store } = makeApp();
    const res = await post(app, '/admin/reports', await sessionCookie(app, ADMIN), body);
    expect(res.status).toBe(status);
    expect(await res.text()).toContain(message);
    expect(await store.list()).toEqual([]);
  });

  it('menerima ekstensi .HTM dan judul tepat 120 karakter', async () => {
    const { app, store } = makeApp();
    const res = await post(app, '/admin/reports', await sessionCookie(app, ADMIN), form({ title: 'x'.repeat(120), name: 'LAPORAN.HTM' }));
    expect(res.status).toBe(303);
    expect(await store.list()).toHaveLength(1);
  });

  it('judul berbahaya tersimpan apa adanya tetapi ditampilkan ter-escape di daftar dan admin', async () => {
    const { app } = makeApp();
    const admin = await sessionCookie(app, ADMIN);
    await post(app, '/admin/reports', admin, form({ title: '<img src=x onerror=alert(1)>', name: 'a.html' }));
    for (const path of ['/', '/admin']) {
      const body = await (await get(app, path, admin)).text();
      expect(body).not.toContain('<img src=x');
      expect(body).toContain('&lt;img src=x onerror=alert(1)&gt;');
    }
  });
});

describe('hapus', () => {
  it('admin menghapus laporan', async () => {
    const { app, store } = makeApp();
    const meta = await store.add({ title: 'Hapus saya', html: '<p>x</p>' });
    const res = await post(app, `/admin/reports/${meta.id}/delete`, await sessionCookie(app, ADMIN));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin?removed=1');
    expect(await store.list()).toEqual([]);
  });

  it('ID tidak ada atau tidak valid menghasilkan 404 tanpa mengubah apa pun', async () => {
    const { app, store } = makeApp();
    await store.add({ title: 'Tetap', html: '<p>x</p>' });
    const admin = await sessionCookie(app, ADMIN);
    for (const id of ['tidak-ada-1', '..%2Findex', 'a'.repeat(40)]) {
      expect((await post(app, `/admin/reports/${id}/delete`, admin)).status).toBe(404);
    }
    expect(await store.list()).toHaveLength(1);
  });
});

describe('otorisasi dan CSRF', () => {
  it('pegawai tidak bisa mengunggah atau menghapus', async () => {
    const { app, store } = makeApp();
    const meta = await store.add({ title: 'Milik admin', html: '<p>x</p>' });
    const viewer = await sessionCookie(app, VIEWER);
    expect((await post(app, '/admin/reports', viewer, form({ title: 'A', name: 'a.html' }))).status).toBe(403);
    expect((await post(app, `/admin/reports/${meta.id}/delete`, viewer)).status).toBe(403);
    expect(await store.list()).toHaveLength(1);
  });

  it('tanpa sesi: POST ditolak 401', async () => {
    const { app } = makeApp();
    const res = await app.request('/admin/reports', { method: 'POST', body: form({ title: 'A', name: 'a.html' }), headers: { origin: 'http://localhost' } });
    expect(res.status).toBe(401);
  });

  it.each([
    ['origin lain', { origin: 'https://situs-jahat.example' }],
    ['tanpa origin', { origin: '' }],
  ])('POST lintas situs dengan cookie admin sah ditolak (%s) dan tidak mengubah apa pun', async (_label, headers) => {
    const { app, store } = makeApp();
    const meta = await store.add({ title: 'Aman', html: '<p>x</p>' });
    const admin = await sessionCookie(app, ADMIN);

    const upload = await post(app, '/admin/reports', admin, form({ title: 'Jahat', name: 'a.html' }), headers);
    const remove = await post(app, `/admin/reports/${meta.id}/delete`, admin, undefined, headers);
    expect([upload.status, remove.status]).toEqual([403, 403]);
    expect((await store.list()).map((item) => item.title)).toEqual(['Aman']);
  });
});
```

- [ ] **Step 2: Jalankan, harus gagal** — `npx vitest run tests/admin.test.ts` → FAIL (rute POST belum ada, 404/405).

- [ ] **Step 3: Implementasi** — ganti blok `// Diganti dengan rute unggah dan hapus di Task 6.` dan rute `GET /admin` sementara di `src/app.ts` dengan:

```ts
  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
  const MAX_TITLE_LENGTH = 120;

  app.get('/admin', async (c) =>
    c.html(
      adminPage({
        reports: await store.list(),
        message: c.req.query('added') ? 'Laporan ditambahkan.' : c.req.query('removed') ? 'Laporan dihapus.' : undefined,
      }),
    ),
  );

  app.post('/admin/reports', async (c) => {
    const reject = async (status: 400 | 413, error: string) => c.html(adminPage({ reports: await store.list(), error }), status);

    const body = await c.req.parseBody();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const file = body.file;

    if (!title || title.length > MAX_TITLE_LENGTH) return reject(400, `Judul wajib diisi, maksimal ${MAX_TITLE_LENGTH} karakter.`);
    if (!(file instanceof File) || file.size === 0) return reject(400, 'Pilih berkas HTML yang tidak kosong.');
    if (!/\.html?$/i.test(file.name)) return reject(400, 'Berkas harus berakhiran .html atau .htm.');
    if (file.size > MAX_UPLOAD_BYTES) return reject(413, 'Ukuran berkas maksimal 4 MB.');

    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    } catch {
      return reject(400, 'Berkas harus berupa teks UTF-8.');
    }

    await store.add({ title, html: content });
    return c.redirect('/admin?added=1', 303);
  });

  app.post('/admin/reports/:id/delete', async (c) => {
    const id = c.req.param('id');
    const removed = isValidReportId(id) && (await store.remove(id));
    return removed ? c.redirect('/admin?removed=1', 303) : notFound(c);
  });
```

Pastikan deklarasi `notFound` (Task 5) berada di atas blok ini.

- [ ] **Step 4: Jalankan, harus lolos** — `npx vitest run && npx tsc --noEmit` → semua PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: unggah dan hapus laporan oleh admin"`

---

### Task 7: Titik masuk, backend Blob, laporan contoh, dan server lokal

**Files:**
- Create: `src/bootstrap.ts`, `src/index.ts`, `src/dev.ts`, `src/store/blob-backend.ts`, `src/store/from-env.ts`, `samples/laporan-contoh.html`
- Test: `tests/bootstrap.test.ts`

**Interfaces:**
- Consumes: semua modul sebelumnya.
- Produces: `buildApp(env: Record<string, string | undefined>): Hono` (tidak pernah melempar; konfigurasi buruk menghasilkan aplikasi yang menjawab 503 di semua rute); `createStoreFromEnv(env): ReportStore` (melempar `ConfigError` bila di Vercel tanpa token Blob); `createBlobBackend(): ObjectBackend`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/bootstrap.test.ts
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
    const app = buildApp({ ...good, ADMIN_PASSWORD: 'rahasia-pendek' });
    const res = await app.request('/login');
    expect(await res.text()).not.toContain('rahasia-pendek');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('rahasia-pendek');
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
```

- [ ] **Step 2: Jalankan, harus gagal** — `npx vitest run tests/bootstrap.test.ts` → FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi**

```ts
// src/store/blob-backend.ts
import { del, get, put } from '@vercel/blob';
import type { ObjectBackend } from './types';

// Kontraknya adalah ObjectBackend. Bila tipe @vercel/blob yang terpasang berbeda dari yang dipakai di sini,
// ubah isi fungsi ini sampai `npx tsc --noEmit` lolos; jangan ubah antarmuka ObjectBackend.
export function createBlobBackend(): ObjectBackend {
  return {
    async read(path) {
      const result = await get(path, { access: 'private' });
      if (!result || result.statusCode !== 200) return null;
      return new Response(result.stream).text();
    },
    async write(path, body) {
      await put(path, body, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: path.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8',
      });
    },
    async remove(path) {
      await del(path);
    },
  };
}
```

```ts
// src/store/from-env.ts
import { ConfigError } from '../config';
import { createBlobBackend } from './blob-backend';
import { createFileBackend } from './file-backend';
import { createReportStore } from './report-store';
import type { ReportStore } from './types';

export function createStoreFromEnv(env: Record<string, string | undefined>): ReportStore {
  if (env.BLOB_READ_WRITE_TOKEN) return createReportStore(createBlobBackend());
  if (env.VERCEL) throw new ConfigError(['BLOB_READ_WRITE_TOKEN wajib diisi (hubungkan Blob store ke project)']);
  return createReportStore(createFileBackend('.data'));
}
```

```ts
// src/bootstrap.ts
import { Hono } from 'hono';
import { createApp } from './app';
import { ConfigError, loadConfig } from './config';
import { createLoginLimiter } from './rate-limit';
import { createStoreFromEnv } from './store/from-env';

// Tidak pernah melempar: konfigurasi buruk menghasilkan aplikasi yang menutup semua rute dengan 503.
export function buildApp(env: Record<string, string | undefined>) {
  try {
    const config = loadConfig(env);
    return createApp({ config, store: createStoreFromEnv(env), limiter: createLoginLimiter() });
  } catch (error) {
    console.error(error instanceof ConfigError ? error.message : 'Aplikasi gagal dimulai');
    const closed = new Hono();
    closed.all('*', (c) => c.text('Layanan belum dikonfigurasi.', 503));
    return closed;
  }
}
```

```ts
// src/index.ts
import { buildApp } from './bootstrap';

export default buildApp(process.env);
```

```ts
// src/dev.ts
import { serve } from '@hono/node-server';
import { readFile } from 'node:fs/promises';
import { buildApp } from './bootstrap';
import { createFileBackend } from './store/file-backend';
import { createReportStore } from './store/report-store';

// Nilai bawaan hanya untuk pengembangan lokal; produksi memakai env var Vercel.
const env = {
  ADMIN_PASSWORD: 'dev-admin-password',
  VIEWER_PASSWORD: 'dev-viewer-password',
  SESSION_SECRET: 'dev-session-secret-for-local-use-only',
  ...process.env,
};

// Menyemai laporan contoh bila penyimpanan lokal masih kosong.
const store = createReportStore(createFileBackend('.data'));
if ((await store.list()).length === 0) {
  await store.add({ title: 'Laporan contoh', html: await readFile('samples/laporan-contoh.html', 'utf8') });
}

const port = Number(env.PORT ?? 3000);
serve({ fetch: buildApp(env).fetch, port }, () => {
  console.log(`http://localhost:${port}  (admin: ${env.ADMIN_PASSWORD}, pegawai: ${env.VIEWER_PASSWORD})`);
});
```

`samples/laporan-contoh.html` (laporan dummy yang sekaligus memeriksa sandbox; tulis dengan alat Write):

```html
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Laporan contoh</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #101820; }
  table { border-collapse: collapse; width: 100%; max-width: 32rem; }
  th, td { border: 1px solid #d7e2e8; padding: .5rem .75rem; text-align: left; }
  .ok { color: #14785f; font-weight: 600; } .bad { color: #9b1c1c; font-weight: 600; }
</style>
</head>
<body>
<h1>Laporan contoh</h1>
<p>Ini data tiruan untuk memeriksa tampilan. Hapus lewat halaman admin bila sudah tidak diperlukan.</p>
<table>
  <tr><th>Bulan</th><th>Pesanan</th><th>Status</th></tr>
  <tr><td>Agustus</td><td>12</td><td>Selesai</td></tr>
  <tr><td>September</td><td>18</td><td>Selesai</td></tr>
  <tr><td>Oktober</td><td>7</td><td>Berjalan</td></tr>
</table>

<h2>Pemeriksaan keamanan</h2>
<p>Skrip di bawah mencoba membaca cookie dan memanggil halaman admin. Keduanya harus <strong>diblokir</strong>.</p>
<ul>
  <li>Membaca cookie: <span id="cookie">menunggu…</span></li>
  <li>Memanggil <code>/admin</code>: <span id="fetch">menunggu…</span></li>
</ul>
<script>
  const show = (id, blocked, text) => {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = blocked ? 'ok' : 'bad';
  };
  try {
    const value = document.cookie;
    show('cookie', false, 'TIDAK diblokir (isi: ' + JSON.stringify(value) + ')');
  } catch (error) {
    show('cookie', true, 'diblokir (' + error.name + ')');
  }
  fetch('/admin', { credentials: 'include' })
    .then((response) => show('fetch', false, 'TIDAK diblokir (status ' + response.status + ')'))
    .catch(() => show('fetch', true, 'diblokir'));
</script>
</body>
</html>
```

- [ ] **Step 4: Jalankan, harus lolos**

Run: `npx vitest run && npx tsc --noEmit`
Expected: semua PASS. Bila `tsc` mengeluh tentang tipe `@vercel/blob`, baca `node_modules/@vercel/blob` dan sesuaikan `blob-backend.ts` saja (lihat komentar di berkas itu).

- [ ] **Step 5: Smoke lokal dengan server nyata**

Run (latar belakang): `npm run dev`, lalu:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/        # 303 .../login
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/robots.txt              # 200
curl -s -i -c /tmp/jar -H "Origin: http://localhost:3000" -d "password=dev-viewer-password" http://localhost:3000/login | head -12
```

Expected: 303 ke `/login`, 200, lalu 303 ke `/` dengan `Set-Cookie: __Host-overview_session=...; HttpOnly; Secure; SameSite=Strict`. Catatan: `curl` menolak mengirim ulang cookie `Secure` lewat HTTP, jadi pemeriksaan halaman berlogin dilakukan di browser pada `http://localhost:3000` (Chrome dan Firefox memperlakukan localhost sebagai konteks aman). Buka browser: login sebagai pegawai, buka "Laporan contoh", pastikan kedua baris pemeriksaan keamanan berwarna hijau "diblokir"; login sebagai admin, unggah dan hapus satu berkas. Hentikan server.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: titik masuk, backend Blob, laporan contoh, dan server lokal"`

---

### Task 8: Dokumentasi dan verifikasi akhir

**Files:**
- Create: `README.md`

- [ ] **Step 1: Tulis `README.md`** berisi, dalam bahasa Indonesia: tujuan singkat; cara menjalankan lokal (`npm install`, `npm run dev`, nilai bawaan dev, alamat); tabel env var (nama, aturan, tempat mengisi); aturan laporan yang bisa diunggah (HTML mandiri, tanpa sumber eksternal, maksimal 4 MB, UTF-8); cara mengganti sandi (ubah env var di Vercel lalu deploy ulang; ganti `SESSION_SECRET` untuk mengeluarkan semua sesi); keterbatasan (dua sandi bersama, pembatas login best effort, indeks bisa saling menimpa bila dua admin mengunggah serentak); dan langkah rilis dari spec bagian 10 persis, ditandai "menunggu konfirmasi pemilik" untuk langkah 4 sampai 8.

- [ ] **Step 2: Verifikasi akhir**

Run: `npm run check`
Expected: `tsc` tanpa galat dan seluruh tes lolos. Laporkan jumlah tes yang lolos apa adanya.

- [ ] **Step 3: Tinjauan** — satu peninjau baru atas seluruh diff terhadap spec dan Global Constraints, dengan bagian Review Focus di atas disalin apa adanya. Perbaiki temuan Critical dan Important dengan tes yang gagal lebih dulu.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "docs: panduan menjalankan dan merilis portal laporan"`

- [ ] **Step 5: Berhenti dan laporkan ke pemilik.** Jangan membuat repo GitHub, project Vercel, Blob store, env var, domain, atau DNS. Minta konfirmasi pemilik untuk langkah rilis spec bagian 10 (4 sampai 8). Sandi dibuat dan diisi sendiri oleh pemilik di dashboard Vercel.
