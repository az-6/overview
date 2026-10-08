// src/bootstrap.ts
import { Hono } from 'hono';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';
import { createLoginLimiter } from './rate-limit.js';
import { createStoresFromEnv } from './store/from-env.js';

// Tidak pernah melempar: konfigurasi buruk menghasilkan aplikasi yang menutup semua rute dengan 503.
export function buildApp(env: Record<string, string | undefined>) {
  try {
    const config = loadConfig(env);
    return createApp({ config, ...createStoresFromEnv(env), limiter: createLoginLimiter() });
  } catch (error) {
    console.error(error instanceof ConfigError ? error.message : 'Aplikasi gagal dimulai');
    const closed = new Hono();
    closed.all('*', (c) => c.text('Layanan belum dikonfigurasi.', 503));
    return closed;
  }
}
