// src/store/types.ts
import type { Dana, Siklus } from '../siklus/types';

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

// Dihapus di Task 6 bersama report-store.
export interface ReportMeta {
  id: string;
  title: string;
  uploadedAt: string;
  size: number;
}

export interface ReportStore {
  list(): Promise<ReportMeta[]>;
  get(id: string): Promise<{ meta: ReportMeta; html: string } | null>;
  add(input: { title: string; html: string }): Promise<ReportMeta>;
  remove(id: string): Promise<boolean>;
}
