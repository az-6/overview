import { serve } from '@hono/node-server';
import { readFile } from 'node:fs/promises';
import { buildApp } from './bootstrap';
import { createFileBackend } from './store/file-backend';
import { createReportStore } from './store/report-store';

// Nilai bawaan hanya untuk pengembangan lokal; produksi memakai env var Vercel.
const env: Record<string, string | undefined> = {
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
