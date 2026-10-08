// src/views/format.ts
// Tanggal YYYY-MM-DD ditafsirkan sebagai tanggal kalender WIB.
export const tgl = (d: string | undefined) =>
  d
    ? new Date(`${d}T00:00:00+07:00`).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      })
    : '—';
