// tests/dana-store.test.ts
import { describe, expect, it } from 'vitest';
import { BatasDanaError, createDanaStore, DANA_MAKS, isValidDanaId } from '../src/store/dana-store';
import { createMemoryBackend } from '../src/store/memory-backend';
import type { ObjectBackend } from '../src/store/types';

const buat = () => {
  const backend = createMemoryBackend();
  let n = 0;
  const store = createDanaStore(backend, { newId: () => `dana-${String(++n).padStart(4, '0')}` });
  return { backend, store };
};
const isian = (tanggal: string, jumlah = 1000, keterangan = 'Uji') => ({ tanggal, jumlah, keterangan });

describe('DanaStore', () => {
  it('menambah dana dengan ID baru dan mengurutkan menurut tanggal naik', async () => {
    const { store } = buat();
    const b = await store.add(isian('2026-10-07'));
    const a = await store.add(isian('2026-10-05'));
    expect(a).toEqual({ id: 'dana-0002', tanggal: '2026-10-05', jumlah: 1000, keterangan: 'Uji' });
    expect(b.id).toBe('dana-0001');
    expect((await store.list()).map((d) => d.tanggal)).toEqual(['2026-10-05', '2026-10-07']);
  });

  it('tanggal sama diurutkan menurut ID', async () => {
    const { store } = buat();
    await store.add(isian('2026-10-05', 1));
    await store.add(isian('2026-10-05', 2));
    expect((await store.list()).map((d) => d.id)).toEqual(['dana-0001', 'dana-0002']);
  });

  it('menghapus dana dan menolak ID yang tidak ada', async () => {
    const { store } = buat();
    const dana = await store.add(isian('2026-10-05'));
    expect(await store.remove(dana.id)).toBe(true);
    expect(await store.list()).toEqual([]);
    expect(await store.remove(dana.id)).toBe(false);
  });

  it.each(['../index', '..%2Findex', 'a/b', 'pendek', 'x'.repeat(33), 'spasi di sini', ''])(
    'ID %j tidak valid tidak menyentuh backend',
    async (id) => {
      const dibaca: string[] = [];
      const spy: ObjectBackend = {
        read: async (path) => (dibaca.push(path), null),
        write: async () => {},
        remove: async () => {},
      };
      expect(isValidDanaId(id)).toBe(false);
      expect(await createDanaStore(spy).remove(id)).toBe(false);
      expect(dibaca).toEqual([]);
    },
  );

  it('menolak entri ke-201 dan tidak mengubah apa pun', async () => {
    const { store, backend } = buat();
    const awal = Array.from({ length: DANA_MAKS }, (_v, i) => ({ id: `dana-${String(i).padStart(4, '0')}`, tanggal: '2026-10-05', jumlah: 1, keterangan: '' }));
    await backend.write('data/dana.json', JSON.stringify(awal));
    await expect(store.add(isian('2026-10-06'))).rejects.toBeInstanceOf(BatasDanaError);
    expect(await store.list()).toHaveLength(DANA_MAKS);
  });

  it('melaporkan dokumen rusak sebagai galat', async () => {
    const backend = createMemoryBackend();
    await backend.write('data/dana.json', '{"a":1}');
    await expect(createDanaStore(backend).list()).rejects.toThrow('Dokumen dana rusak');
    await backend.write('data/dana.json', 'bukan json');
    await expect(createDanaStore(backend).list()).rejects.toThrow();
  });

  it('membuat ID acak yang lolos pola bila newId tidak diberikan', async () => {
    const store = createDanaStore(createMemoryBackend());
    const dana = await store.add(isian('2026-10-05'));
    expect(isValidDanaId(dana.id)).toBe(true);
  });
});
