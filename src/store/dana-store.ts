// src/store/dana-store.ts
import type { Dana } from '../siklus/types.js';
import type { DanaStore, ObjectBackend } from './types.js';

const PATH = 'data/dana.json';
const ID_POLA = /^[A-Za-z0-9_-]{8,32}$/;
export const DANA_MAKS = 200;

export const isValidDanaId = (id: string) => ID_POLA.test(id);
const urut = (daftar: Dana[]) =>
  [...daftar].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id.localeCompare(b.id));

export class BatasDanaError extends Error {
  constructor() {
    super(`Dana sudah mencapai batas ${DANA_MAKS} entri.`);
    this.name = 'BatasDanaError';
  }
}

interface Opsi {
  newId?: () => string;
}

export function createDanaStore(backend: ObjectBackend, opsi: Opsi = {}): DanaStore {
  const newId = opsi.newId ?? (() => crypto.randomUUID().replaceAll('-', '').slice(0, 12));

  const baca = async (): Promise<Dana[]> => {
    const mentah = await backend.read(PATH);
    if (mentah === null) return [];
    const data: unknown = JSON.parse(mentah);
    if (!Array.isArray(data)) throw new Error('Dokumen dana rusak');
    return urut(data as Dana[]);
  };
  const tulis = (daftar: Dana[]) => backend.write(PATH, JSON.stringify(urut(daftar)));

  return {
    list: baca,

    async add(input) {
      const daftar = await baca();
      if (daftar.length >= DANA_MAKS) throw new BatasDanaError();
      const dana: Dana = { id: newId(), ...input };
      await tulis([...daftar, dana]);
      return dana;
    },

    async remove(id) {
      if (!isValidDanaId(id)) return false;
      const daftar = await baca();
      if (!daftar.some((d) => d.id === id)) return false;
      await tulis(daftar.filter((d) => d.id !== id));
      return true;
    },
  };
}
