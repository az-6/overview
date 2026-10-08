import { describe, expect, it } from 'vitest';
import { createMemoryBackend } from '../src/store/memory-backend';
import { createReportStore, isValidReportId } from '../src/store/report-store';
import type { ObjectBackend } from '../src/store/types';

const make = () => {
  const backend = createMemoryBackend();
  let n = 0;
  let t = Date.parse('2026-10-08T00:00:00Z');
  const store = createReportStore(backend, {
    newId: () => `laporan-${String(++n).padStart(4, '0')}`,
    now: () => new Date((t += 60_000)),
  });
  return { backend, store };
};

describe('ReportStore', () => {
  it('menambah laporan dan menampilkan yang terbaru lebih dulu', async () => {
    const { store } = make();
    await store.add({ title: 'Pertama', html: '<p>satu</p>' });
    const second = await store.add({ title: 'Kedua', html: '<p>dua</p>' });
    expect((await store.list()).map((item) => item.title)).toEqual(['Kedua', 'Pertama']);
    expect(second).toMatchObject({ id: 'laporan-0002', title: 'Kedua', size: 10 });
    expect(await store.get('laporan-0002')).toEqual({ meta: second, html: '<p>dua</p>' });
  });

  it('menghitung ukuran dalam byte, bukan karakter', async () => {
    const { store } = make();
    expect((await store.add({ title: 'x', html: 'é' })).size).toBe(2);
  });

  it('menghapus laporan dan menolak ID yang tidak ada', async () => {
    const { store, backend } = make();
    const meta = await store.add({ title: 'Hapus', html: '<p>x</p>' });
    expect(await store.remove(meta.id)).toBe(true);
    expect(await store.list()).toEqual([]);
    expect(backend.files.has(`reports/${meta.id}.html`)).toBe(false);
    expect(await store.remove(meta.id)).toBe(false);
    expect(await store.get(meta.id)).toBeNull();
  });

  it.each(['../index', '..%2Findex', 'a/b', 'pendek', 'x'.repeat(33), 'spasi di sini', ''])(
    'menolak ID tidak valid %j tanpa menyentuh backend',
    async (id) => {
      const reads: string[] = [];
      const spy: ObjectBackend = {
        read: async (path) => (reads.push(path), null),
        write: async () => {},
        remove: async () => {},
      };
      const store = createReportStore(spy);
      expect(isValidReportId(id)).toBe(false);
      expect(await store.get(id)).toBeNull();
      expect(await store.remove(id)).toBe(false);
      expect(reads).toEqual([]);
    },
  );

  it('menulis HTML sebelum indeks: kegagalan tengah tidak meninggalkan entri tanpa isi', async () => {
    const backend = createMemoryBackend();
    const failing: ObjectBackend = {
      ...backend,
      write: async (path, body) => {
        if (path === 'reports/index.json') throw new Error('Blob gagal');
        await backend.write(path, body);
      },
    };
    const store = createReportStore(failing, { newId: () => 'laporan-0001' });
    await expect(store.add({ title: 'Gagal', html: '<p>x</p>' })).rejects.toThrow('Blob gagal');
    expect(await store.list()).toEqual([]);
  });

  it('menghapus dari indeks sebelum berkas: kegagalan hapus berkas tidak menampilkan entri tanpa isi', async () => {
    const backend = createMemoryBackend();
    const store = createReportStore(
      { ...backend, remove: async () => { throw new Error('hapus gagal'); } },
      { newId: () => 'laporan-0001' },
    );
    const meta = await store.add({ title: 'A', html: '<p>x</p>' });
    await expect(store.remove(meta.id)).rejects.toThrow('hapus gagal');
    expect(await store.list()).toEqual([]);
  });

  it('melaporkan indeks yang rusak sebagai galat, bukan daftar kosong', async () => {
    const backend = createMemoryBackend();
    await backend.write('reports/index.json', '{bukan json');
    await expect(createReportStore(backend).list()).rejects.toThrow();
    await backend.write('reports/index.json', '{"a":1}');
    await expect(createReportStore(backend).list()).rejects.toThrow('Indeks laporan rusak');
  });
});
