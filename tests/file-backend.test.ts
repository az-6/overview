import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createFileBackend } from '../src/store/file-backend';

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'overview-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

it('menulis, membaca, dan menghapus', async () => {
  const backend = createFileBackend(root);
  expect(await backend.read('reports/a.html')).toBeNull();
  await backend.write('reports/a.html', '<p>é</p>');
  expect(await backend.read('reports/a.html')).toBe('<p>é</p>');
  await backend.remove('reports/a.html');
  expect(await backend.read('reports/a.html')).toBeNull();
  await expect(backend.remove('reports/a.html')).resolves.toBeUndefined();
});

it('menolak path di luar folder data', async () => {
  const backend = createFileBackend(root);
  await expect(backend.read('../rahasia.txt')).rejects.toThrow('luar folder');
  await expect(backend.write('../../x', 'x')).rejects.toThrow('luar folder');
});
