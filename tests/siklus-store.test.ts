// tests/siklus-store.test.ts
import { describe, expect, it } from 'vitest';
import { createMemoryBackend } from '../src/store/memory-backend';
import { createSiklusStore, parseNo, SiklusSudahAdaError } from '../src/store/siklus-store';
import type { ObjectBackend } from '../src/store/types';
import { siklusContoh } from './fixtures';

describe('SiklusStore', () => {
  it('kosong pada awalnya dan mengurutkan menurut nomor naik', async () => {
    const store = createSiklusStore(createMemoryBackend());
    expect(await store.list()).toEqual([]);
    await store.put(siklusContoh({ no: 3 }), { timpa: false });
    await store.put(siklusContoh({ no: 1 }), { timpa: false });
    await store.put(siklusContoh({ no: 2 }), { timpa: false });
    expect((await store.list()).map((s) => s.no)).toEqual([1, 2, 3]);
    expect((await store.get(2))?.no).toBe(2);
    expect(await store.get(4)).toBeNull();
  });

  it('menolak nomor kembar tanpa timpa dan tidak mengubah apa pun', async () => {
    const store = createSiklusStore(createMemoryBackend());
    expect(await store.put(siklusContoh({ pembeli: 'Lama' }), { timpa: false })).toBe('ditambah');
    await expect(store.put(siklusContoh({ pembeli: 'Baru' }), { timpa: false })).rejects.toBeInstanceOf(SiklusSudahAdaError);
    expect((await store.get(1))?.pembeli).toBe('Lama');
  });

  it('mengganti seluruh siklus bila timpa', async () => {
    const store = createSiklusStore(createMemoryBackend());
    await store.put(siklusContoh({ pembeli: 'Lama' }), { timpa: false });
    expect(await store.put(siklusContoh({ pembeli: 'Baru', ekor: [] }), { timpa: true })).toBe('diganti');
    const daftar = await store.list();
    expect(daftar).toHaveLength(1);
    expect(daftar[0]).toMatchObject({ pembeli: 'Baru', ekor: [] });
  });

  it('menghapus siklus dan menolak nomor yang tidak ada', async () => {
    const store = createSiklusStore(createMemoryBackend());
    await store.put(siklusContoh(), { timpa: false });
    expect(await store.remove(1)).toBe(true);
    expect(await store.list()).toEqual([]);
    expect(await store.remove(1)).toBe(false);
  });

  it.each([0, -1, 10000, 1.5, Number.NaN])('nomor %s tidak valid tidak menyentuh backend', async (no) => {
    const dibaca: string[] = [];
    const spy: ObjectBackend = {
      read: async (path) => (dibaca.push(path), null),
      write: async () => {},
      remove: async () => {},
    };
    const store = createSiklusStore(spy);
    expect(await store.get(no)).toBeNull();
    expect(await store.remove(no)).toBe(false);
    expect(dibaca).toEqual([]);
  });

  it('melaporkan dokumen rusak sebagai galat, bukan daftar kosong', async () => {
    const backend = createMemoryBackend();
    await backend.write('data/siklus.json', '{bukan json');
    await expect(createSiklusStore(backend).list()).rejects.toThrow();
    await backend.write('data/siklus.json', '{"a":1}');
    await expect(createSiklusStore(backend).list()).rejects.toThrow('Dokumen siklus rusak');
  });

  it('kegagalan tulis tidak mengubah isi yang sudah ada', async () => {
    const backend = createMemoryBackend();
    const awal = createSiklusStore(backend);
    await awal.put(siklusContoh({ pembeli: 'Lama' }), { timpa: false });
    const gagal = createSiklusStore({ ...backend, write: async () => { throw new Error('Blob gagal'); } });
    await expect(gagal.put(siklusContoh({ pembeli: 'Baru' }), { timpa: true })).rejects.toThrow('Blob gagal');
    expect((await awal.get(1))?.pembeli).toBe('Lama');
  });
});

describe('parseNo', () => {
  it.each(['1', '9', '10', '9999'])('menerima %s', (teks) => {
    expect(parseNo(teks)).toBe(Number(teks));
  });
  it.each(['0', '01', '10000', '-1', '1.5', 'abc', '', '..', '../1', '1 ', '١'])('menolak %j', (teks) => {
    expect(parseNo(teks)).toBeNull();
  });
});
