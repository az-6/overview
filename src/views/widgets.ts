// src/views/widgets.ts
import { html } from 'hono/html';

export interface KpiItem {
  k: string;
  v: string;
  s: string;
  kelas?: 'naik' | 'turun';
}

export const kpi = (items: KpiItem[]) =>
  html`<div class="kpi">${items.map(
    (i) => html`<div><span class="k">${i.k}</span><span class="v ${i.kelas ?? ''}">${i.v}</span><span class="s">${i.s}</span></div>`,
  )}</div>`;

export interface BatangItem {
  label: string;
  v: number | null;
}

const batasi = (n: number) => Number(Math.min(100, Math.max(0, n)).toFixed(2));

// Batang mendatar bertanda: nol selalu tergambar, nilai negatif ke kiri. Semua persentase dibatasi 0 sampai 100.
export function batang(items: BatangItem[], opsi: { format: (v: number | null) => string; target?: number }) {
  const nilai = items.map((i) => i.v ?? 0).concat(opsi.target ?? 0, 0);
  const lo = Math.min(...nilai);
  const hi = Math.max(...nilai);
  const rentang = hi - lo || 1;
  const pos = (v: number) => batasi(((v - lo) / rentang) * 100);

  return html`<div class="hbar">${items.map((i) => {
    const v = i.v;
    const isi =
      v == null
        ? ''
        : html`<div class="isi ${v < 0 ? 'neg' : ''}" style="left:${pos(Math.min(0, v))}%;width:${batasi(Math.abs(pos(v) - pos(0)))}%"></div>`;
    const target = opsi.target != null ? html`<div class="target" style="left:${pos(opsi.target)}%"></div>` : '';
    return html`<div class="row"><span>${i.label}</span><div class="trak">${isi}<div class="nol" style="left:${pos(0)}%"></div>${target}</div><span class="r">${opsi.format(v)}</span></div>`;
  })}</div>`;
}
