import { del, get, put } from '@vercel/blob';
import type { ObjectBackend } from './types.js';

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
