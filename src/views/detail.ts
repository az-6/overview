// src/views/detail.ts
import { html } from 'hono/html';
import type { Role } from '../session.js';
import { kg, persen, ringkasSiklus, rp, rpRingkas } from '../siklus/hitung.js';
import type { Siklus } from '../siklus/types.js';
import { tgl } from './format.js';
import { navSiklus, shell } from './layout.js';
import { batang, kpi } from './widgets.js';

const kelasLaba = (n: number): 'naik' | 'turun' => (n < 0 ? 'turun' : 'naik');
const angka = (n: number) => n.toLocaleString('id-ID');

function grafikEkor(s: Siklus) {
  const MAKS = 0.8;
  const ramai = s.ekor.length > 20;
  const lebar = `--lebar:${s.ekor.length * 10}px`;
  const batangEkor = s.ekor.map((e) => {
    const y = e.loinKg / e.kg;
    const tinggi = Number(((Math.min(y, MAKS) / MAKS) * 100).toFixed(2));
    return html`<div class="b ${/^C/i.test(e.grade) ? 'c' : ''}" style="height:${tinggi}%" title="Tag ${e.tag}: ${kg(e.kg, 0)}, yield ${persen(y)}, grade ${e.grade}">${ramai ? '' : html`<span>${persen(y).replace(' %', '')}</span>`}</div>`;
  });
  const label = ramai
    ? ''
    : html`<div class="yx" style="${lebar}">${s.ekor.map((e) => html`<div>${e.tag}<br>${kg(e.kg, 0)}</div>`)}</div>`;
  return html`<div class="gulir"><div class="yield" style="${lebar}"><div class="garis" style="bottom:${Number(((0.6 / MAKS) * 172).toFixed(2))}px"></div>${batangEkor}</div>${label}</div>
    <div class="legend"><span><i style="background:var(--laut)"></i>Grade A/B</span><span><i style="background:var(--muted)"></i>Grade C</span><span><i style="background:var(--turun)"></i>Rencana 60 %</span></div>`;
}

export function detailPage({ daftar, siklus: s, peran }: { daftar: Siklus[]; siklus: Siklus; peran: Role }) {
  const r = ringkasSiklus(s);
  const i = daftar.findIndex((x) => x.no === s.no);
  const seb: Siklus | undefined = daftar[i - 1];
  const ses: Siklus | undefined = daftar[i + 1];
  const totalBiaya = r.biaya || 1;

  const isi = html`${kpi([
      { k: 'Ikan utuh diterima', v: kg(r.kgIkan, 0), s: `${r.ekor} ekor` },
      { k: 'Loin dihasilkan', v: kg(r.kgLoin), s: `Yield ${persen(r.yield)}` },
      { k: 'Pendapatan', v: rpRingkas(r.pendapatan), s: r.hargaRataLoin == null ? '—' : `Rata-rata loin ${rp(Math.round(r.hargaRataLoin))}/kg` },
      { k: r.laba < 0 ? 'Rugi' : 'Laba', v: rpRingkas(r.laba), s: `Margin ${persen(r.margin)}`, kelas: kelasLaba(r.laba) },
    ])}
    <section><p class="eyebrow">Produksi</p><h2>Yield per ekor</h2>
      <div class="panel">${s.ekor.length ? grafikEkor(s) : html`<p class="muted" style="margin:0">Belum ada ekor yang dicatat.</p>`}</div>
    </section>
    <section><p class="eyebrow">Hasil keuangan</p><h2>Pendapatan dan biaya</h2>
      <div class="panel gulir"><table>
        <thead><tr><th>Pos</th><th class="r">Hitungan</th><th class="r">Rp</th></tr></thead>
        <tbody>
          ${s.penjualan.map((p) => html`<tr><td>${p.nama}</td><td class="r">${kg(p.kg)} × ${angka(p.harga)}</td><td class="r">${angka(Math.round(p.kg * p.harga))}</td></tr>`)}
          <tr class="total"><td>Pendapatan</td><td></td><td class="r">${angka(r.pendapatan)}</td></tr>
          ${s.biaya.map((b) => html`<tr><td>${b.nama}</td><td></td><td class="r">${angka(b.rp)}</td></tr>`)}
          <tr class="total"><td>Biaya</td><td class="r">${r.hppPerKgLoin == null ? '' : `${rp(Math.round(r.hppPerKgLoin))}/kg loin`}</td><td class="r">${angka(r.biaya)}</td></tr>
          <tr class="total"><td>${r.laba < 0 ? 'Rugi' : 'Laba'}</td><td class="r">margin ${persen(r.margin)}</td><td class="r ${r.laba < 0 ? 'turun' : ''}">${rp(r.laba).replace('Rp ', '')}</td></tr>
        </tbody></table></div>
    </section>
    <section><p class="eyebrow">Struktur biaya</p><h2>Ke mana biayanya pergi</h2>
      <div class="panel biaya">${batang(s.biaya.map((b) => ({ label: b.nama, v: b.rp / totalBiaya })), { format: (v) => persen(v) })}</div>
    </section>
    ${s.langkah.length
      ? html`<section><p class="eyebrow">Langkah berikutnya</p><h2>Tindak lanjut</h2>
      <div class="panel"><ul class="langkah">${s.langkah.map((l) => html`<li><b>${l.judul}</b><span class="chip ${l.status}">${l.status}</span>${l.isi ? html`<p>${l.isi}</p>` : ''}</li>`)}</ul></div>
    </section>`
      : ''}
    <div class="antar">${seb ? html`<a href="/siklus/${seb.no}">← Siklus ${seb.no}</a>` : html`<span></span>`}<a href="/">Ringkasan</a>${ses ? html`<a href="/siklus/${ses.no}">Siklus ${ses.no} →</a>` : html`<span></span>`}</div>`;

  return shell({
    judul: `Siklus ${s.no}`,
    label: `Siklus ${s.no} · produksi ${tgl(s.produksi)}${s.kirim ? ` · kirim ${tgl(s.kirim)}` : ''}`,
    heading: `Siklus ${s.no}: yield ${persen(r.yield)}, ${r.laba < 0 ? 'rugi' : 'laba'} ${rp(Math.abs(r.laba))}`,
    lead: `${r.ekor} ekor tuna menjadi ${kg(r.kgLoin)} loin untuk ${s.pembeli}.`,
    nav: navSiklus(daftar, s.no),
    peran,
    isi,
  });
}
