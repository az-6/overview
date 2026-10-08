import type { ObjectBackend, ReportMeta, ReportStore } from './types';

const ID_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;
const INDEX_PATH = 'reports/index.json';
const htmlPath = (id: string) => `reports/${id}.html`;

export const isValidReportId = (id: string) => ID_PATTERN.test(id);

interface Options {
  newId?: () => string;
  now?: () => Date;
}

export function createReportStore(backend: ObjectBackend, options: Options = {}): ReportStore {
  const newId = options.newId ?? (() => crypto.randomUUID().replaceAll('-', '').slice(0, 12));
  const now = options.now ?? (() => new Date());

  const readIndex = async (): Promise<ReportMeta[]> => {
    const raw = await backend.read(INDEX_PATH);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Indeks laporan rusak');
    return parsed as ReportMeta[];
  };
  const writeIndex = (index: ReportMeta[]) => backend.write(INDEX_PATH, JSON.stringify(index));

  return {
    list: readIndex,

    async get(id) {
      if (!isValidReportId(id)) return null;
      const meta = (await readIndex()).find((item) => item.id === id);
      if (!meta) return null;
      const html = await backend.read(htmlPath(id));
      return html === null ? null : { meta, html };
    },

    // HTML ditulis lebih dulu: kegagalan di tengah hanya meninggalkan berkas yatim.
    async add({ title, html }) {
      const meta: ReportMeta = {
        id: newId(),
        title,
        uploadedAt: now().toISOString(),
        size: new TextEncoder().encode(html).length,
      };
      await backend.write(htmlPath(meta.id), html);
      await writeIndex([meta, ...(await readIndex())]);
      return meta;
    },

    // Indeks ditulis lebih dulu: tidak pernah ada entri tanpa isi.
    async remove(id) {
      if (!isValidReportId(id)) return false;
      const index = await readIndex();
      if (!index.some((item) => item.id === id)) return false;
      await writeIndex(index.filter((item) => item.id !== id));
      await backend.remove(htmlPath(id));
      return true;
    },
  };
}
