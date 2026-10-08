import type { ObjectBackend } from './types.js';

export function createMemoryBackend(): ObjectBackend & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    read: async (path) => files.get(path) ?? null,
    write: async (path, body) => void files.set(path, body),
    remove: async (path) => void files.delete(path),
  };
}
