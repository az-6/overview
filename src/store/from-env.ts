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
