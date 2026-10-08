// src/views/ringkasan.ts
import { html } from 'hono/html';
import type { Role } from '../session';
import { kg, persen, posisiDana, ringkasSemua, ringkasSiklus, rp, rpRingkas } from '../siklus/hitung';
import type { Dana, Siklus } from '../siklus/types';
import { tgl } from './format';
import { navSiklus, shell } from './layout';
import { batang, kpi } from './widgets';

const kelasLaba = (n: number): 'naik' | 'turun' => (n < 0 ? 'turun' : 'naik');

function bagianDana(dana: Dana[], daftar: Siklus[]) {
  const p = posisiDana(dana, daftar);
  if (!p) return '';
  const porsi = Math.min(1, Math.max(0, p.terpakai / p.diterima));
  const lebar = Number((porsi * 100).toFixed(2));
  const rincian =
    dana.length > 1
      ? html`<div class="gulir" style="margin-top:14px"><table><thead><tr><th>Tanggal</th><th>Keterangan</th><th class="r">Jumlah</th></tr></thead><tbody>${dana.map(
          (x) => html`<tr><td>${tgl(x.tanggal)}</td><td>${x.keterangan}</td><td class="r">${rp(x.jumlah)}</td></tr>`,
        )}</tbody></table></div>`
      : html`<p class="muted" style="margin:6px 0 0;font-size:13px">Diterima ${tgl(dana[0].tanggal)}${dana[0].keterangan ? html` · ${dana[0].keterangan}` : ''}.</p>`;

  return html`<section><p class="eyebrow">Dana investor</p><h2>Sisa dana ${rp(p.sisa)} dari ${rp(p.diterima)} yang diterima</h2>
    <div class="panel">
      <div class="dana">
        <div><span class="k">Dana diterima</span><span class="v">${rpRingkas(p.diterima)}</span></div>
        <div><span class="k">Terpakai untuk biaya produksi</span><span class="v">${rpRingkas(p.terpakai)}</span></div>
        <div><span class="k">Kembali dari penjualan</span><span class="v">${rpRingkas(p.kembali)}</span></div>
        <div><span class="k">Imbal hasil terhadap dana</span><span class="v ${kelasLaba(p.sisa - p.diterima)}">${persen(p.imbal, 2)}</span></div>
      </div>
      <div class="pakai" title="Biaya produksi ${persen(porsi)} dari dana"><div style="width:${lebar}%"></div></div>
      <p class="muted" style="margin:8px 0 0;font-size:13px">Biaya produksi semua siklus = ${persen(porsi)} dari dana yang diterima.</p>
      ${rincian}
      <p class="muted" style="margin:12px 0 0;font-size:13px">Sisa dana dihitung dengan anggapan seluruh penjualan sudah dibayar dan seluruh biaya sudah dilunasi; biaya di luar siklus produksi (gaji kantor, sewa, aset) belum termasuk.</p>
    </div>
  </section>`;
}

export function ringkasanPage({ daftar, dana, peran }: { daftar: Siklus[]; dana: Dana[]; peran: Role }) {
  const t = ringkasSemua(daftar);
  const adaSiklus = t.siklus > 0;
  const tombol = peran === 'admin' ? html`<a class="tombol" href="/admin">Tambah siklus</a>` : '';
  const baris = daftar.map((s) => ({ s, r: ringkasSiklus(s) }));

  const isi = adaSiklus
    ? html`${kpi([
        { k: 'Ikan utuh diterima', v: kg(t.kgIkan, 0), s: `${t.ekor} ekor` },
        { k: 'Loin dihasilkan', v: kg(t.kgLoin), s: `Yield ${persen(t.yield)}` },
        { k: 'Pendapatan', v: rpRingkas(t.pendapatan), s: `Biaya ${rpRingkas(t.biaya)}` },
        { k: t.laba < 0 ? 'Rugi' : 'Laba', v: rpRingkas(t.laba), s: `Margin ${persen(t.margin)}`, kelas: kelasLaba(t.laba) },
      ])}${bagianDana(dana, daftar)}
      <section><p class="eyebrow">Per siklus</p><h2>Yield dan margin tiap siklus</h2>
        <div class="dua">
          <div class="panel"><p class="muted" style="margin:0 0 10px">Yield (garis putus = rencana 60 %)</p>${batang(baris.map(({ s, r }) => ({ label: `Siklus ${s.no}`, v: r.yield })), { format: persen, target: 0.6 })}</div>
          <div class="panel"><p class="muted" style="margin:0 0 10px">Margin laba</p>${batang(baris.map(({ s, r }) => ({ label: `Siklus ${s.no}`, v: r.margin })), { format: persen })}</div>
        </div>
      </section>
      <section><div class="kepala-bagian"><div><p class="eyebrow">Daftar siklus</p><h2>Semua siklus produksi</h2></div>${tombol}</div>
        <div class="panel gulir"><table>
          <thead><tr><th>Siklus</th><th>Produksi</th><th>Pembeli</th><th class="r">Ikan</th><th class="r">Loin</th><th class="r">Yield</th><th class="r">Pendapatan</th><th class="r">Laba</th><th class="r">Margin</th></tr></thead>
          <tbody>${baris.map(
            ({ s, r }) => html`<tr><td><a href="/siklus/${s.no}">Siklus ${s.no}</a></td><td>${tgl(s.produksi)}</td><td>${s.pembeli}</td><td class="r">${kg(r.kgIkan, 0)}</td><td class="r">${kg(r.kgLoin)}</td><td class="r">${persen(r.yield)}</td><td class="r">${rp(r.pendapatan)}</td><td class="r ${r.laba < 0 ? 'turun' : ''}">${rp(r.laba)}</td><td class="r">${persen(r.margin)}</td></tr>`,
          )}
          <tr class="total"><td colspan="3">Total</td><td class="r">${kg(t.kgIkan, 0)}</td><td class="r">${kg(t.kgLoin)}</td><td class="r">${persen(t.yield)}</td><td class="r">${rp(t.pendapatan)}</td><td class="r ${t.laba < 0 ? 'turun' : ''}">${rp(t.laba)}</td><td class="r">${persen(t.margin)}</td></tr>
          </tbody></table></div>
      </section>`
    : html`${bagianDana(dana, daftar)}<section><div class="panel"><p class="muted" style="margin:0 0 12px">Belum ada siklus produksi yang tercatat.</p>${tombol}</div></section>`;

  return shell({
    judul: 'Ringkasan',
    label: `Ringkasan · ${t.siklus} siklus produksi`,
    heading: adaSiklus
      ? `${kg(t.kgLoin)} loin dari ${t.siklus} siklus, ${t.laba < 0 ? 'rugi' : 'laba'} ${rp(Math.abs(t.laba))}`
      : 'Belum ada siklus produksi',
    lead: adaSiklus
      ? `Periode ${tgl(daftar[0].produksi)} sampai ${tgl(daftar[daftar.length - 1].produksi)}. Klik satu siklus untuk rinciannya.`
      : 'Data siklus pertama belum dimasukkan.',
    nav: navSiklus(daftar, 'ringkasan'),
    peran,
    isi,
  });
}
