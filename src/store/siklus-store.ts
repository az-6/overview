// src/store/siklus-store.ts
import type { Siklus } from '../siklus/types';
import type { ObjectBackend, SiklusStore } from './types';

const PATH = 'data/siklus.json';
const NO_POLA = /^[1-9][0-9]{0,3}$/;
const NO_MAKS = 9999;

export const parseNo = (teks: string): number | null => (NO_POLA.test(teks) ? Number(teks) : null);
const nomorSah = (no: number) => Number.isInteger(no) && no >= 1 && no <= NO_MAKS;
const urut = (daftar: Siklus[]) => [...daftar].sort((a, b) => a.no - b.no);

export class SiklusSudahAdaError extends Error {
  constructor(readonly no: number) {
    super(`Siklus ${no} sudah ada`);
    this.name = 'SiklusSudahAdaError';
  }
}

// Semua siklus satu dokumen: satu penulisan per operasi, tidak ada keadaan setengah jadi.
// Dua admin yang menulis serentak bisa saling menimpa (batas yang diterima, lihat spec bagian 12).
export function createSiklusStore(backend: ObjectBackend): SiklusStore {
  const baca = async (): Promise<Siklus[]> => {
    const mentah = await backend.read(PATH);
    if (mentah === null) return [];
    const data: unknown = JSON.parse(mentah);
    if (!Array.isArray(data)) throw new Error('Dokumen siklus rusak');
    return urut(data as Siklus[]);
  };
  const tulis = (daftar: Siklus[]) => backend.write(PATH, JSON.stringify(urut(daftar)));

  return {
    list: baca,

    async get(no) {
      if (!nomorSah(no)) return null;
      return (await baca()).find((s) => s.no === no) ?? null;
    },

    async put(siklus, { timpa }) {
      const daftar = await baca();
      const ada = daftar.some((s) => s.no === siklus.no);
      if (ada && !timpa) throw new SiklusSudahAdaError(siklus.no);
      await tulis([...daftar.filter((s) => s.no !== siklus.no), siklus]);
      return ada ? 'diganti' : 'ditambah';
    },

    async remove(no) {
      if (!nomorSah(no)) return false;
      const daftar = await baca();
      if (!daftar.some((s) => s.no === no)) return false;
      await tulis(daftar.filter((s) => s.no !== no));
      return true;
    },
  };
}
