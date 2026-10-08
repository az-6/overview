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
