import type { Dana, Siklus } from '../siklus/types.js';

export interface ObjectBackend {
  read(path: string): Promise<string | null>;
  write(path: string, body: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface SiklusStore {
  list(): Promise<Siklus[]>;
  get(no: number): Promise<Siklus | null>;
  put(siklus: Siklus, opsi: { timpa: boolean }): Promise<'ditambah' | 'diganti'>;
  remove(no: number): Promise<boolean>;
}

export interface DanaStore {
  list(): Promise<Dana[]>;
  add(input: Omit<Dana, 'id'>): Promise<Dana>;
  remove(id: string): Promise<boolean>;
}
