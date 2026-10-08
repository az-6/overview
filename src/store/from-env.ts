// src/store/from-env.ts
import { ConfigError } from '../config';
import { createBlobBackend } from './blob-backend';
import { createDanaStore } from './dana-store';
import { createFileBackend } from './file-backend';
import { createSiklusStore } from './siklus-store';
import type { DanaStore, ObjectBackend, SiklusStore } from './types';

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
