import { Hono } from 'hono';
import { buildApp } from './bootstrap.js';
import type { AppEnv } from './http-app.js';

const app = new Hono<AppEnv>();
app.route('/', buildApp(process.env));

export default app;
