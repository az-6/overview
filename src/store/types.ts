export interface ReportMeta {
  id: string;
  title: string;
  uploadedAt: string;
  size: number;
}

export interface ObjectBackend {
  read(path: string): Promise<string | null>;
  write(path: string, body: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface ReportStore {
  list(): Promise<ReportMeta[]>;
  get(id: string): Promise<{ meta: ReportMeta; html: string } | null>;
  add(input: { title: string; html: string }): Promise<ReportMeta>;
  remove(id: string): Promise<boolean>;
}
