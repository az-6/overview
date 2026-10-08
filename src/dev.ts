// src/dev.ts
import { serve } from '@hono/node-server';
import { readFile } from 'node:fs/promises';
import { buildApp } from './bootstrap';
import { parseSiklus } from './siklus/validasi';
import { createFileBackend } from './store/file-backend';
import { storesDariBackend } from './store/from-env';

// Nilai bawaan hanya untuk pengembangan lokal; produksi memakai env var Vercel.
const env: Record<string, string | undefined> = {
  ADMIN_PASSWORD: 'dev-admin-password',
  OWNER_PASSWORD: 'dev-owner-password',
  SESSION_SECRET: 'dev-session-secret-for-local-use-only',
  ...process.env,
};

// Menyemai data contoh (fiktif) bila penyimpanan lokal masih kosong.
const stores = storesDariBackend(createFileBackend('.data'));
if ((await stores.siklus.list()).length === 0) {
  const hasil = parseSiklus(await readFile('samples/siklus-contoh.json', 'utf8'));
  if (!hasil.ok) throw new Error(`samples/siklus-contoh.json tidak valid: ${hasil.galat.join('; ')}`);
  await stores.siklus.put(hasil.siklus, { timpa: false });
}
if ((await stores.dana.list()).length === 0) {
  await stores.dana.add({ tanggal: '2026-10-06', jumlah: 1367000000, keterangan: 'Dana investor contoh (fiktif)' });
}

const port = Number(env.PORT ?? 3000);
serve({ fetch: buildApp(env).fetch, port }, () => {
  console.log(`http://localhost:${port}  (admin: ${env.ADMIN_PASSWORD}, owner: ${env.OWNER_PASSWORD})`);
});
