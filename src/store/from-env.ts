// src/store/from-env.ts
import { ConfigError } from '../config.js';
import { createBlobBackend } from './blob-backend.js';
import { createDanaStore } from './dana-store.js';
import { createFileBackend } from './file-backend.js';
import { createSiklusStore } from './siklus-store.js';
import type { DanaStore, ObjectBackend, SiklusStore } from './types.js';

export interface Stores {
  siklus: SiklusStore;
  dana: DanaStore;
}

export const storesDariBackend = (backend: ObjectBackend): Stores => ({
  siklus: createSiklusStore(backend),
  dana: createDanaStore(backend),
});

export function createStoresFromEnv(env: Record<string, string | undefined>): Stores {
  if (env.BLOB_READ_WRITE_TOKEN) return storesDariBackend(createBlobBackend());
  if (env.VERCEL) throw new ConfigError(['BLOB_READ_WRITE_TOKEN wajib diisi (hubungkan Blob store ke project)']);
  return storesDariBackend(createFileBackend('.data'));
}
