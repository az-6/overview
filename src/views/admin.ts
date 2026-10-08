// src/views/admin.ts
import { html } from 'hono/html';
import { rp } from '../siklus/hitung.js';
import type { Dana, Siklus } from '../siklus/types.js';
import { tgl } from './format.js';
import { navSiklus, shell } from './layout.js';

const daftarGalat = (galat?: string[]) =>
  galat && galat.length > 0 ? html`<div class="galat" role="alert"><ul>${galat.map((g) => html`<li>${g}</li>`)}</ul></div>` : '';

export interface AdminInput {
  daftar: Siklus[];
  dana: Dana[];
  pesan?: string;
  galatSiklus?: string[];
  galatDana?: string[];
}

export function adminPage({ daftar, dana, pesan, galatSiklus, galatDana }: AdminInput) {
  const isi = html`
    ${pesan ? html`<p class="sukses" role="status">${pesan}</p>` : ''}
    <section><p class="eyebrow">Siklus produksi</p><h2>Tambah siklus</h2>
      <form class="isian panel" method="post" action="/admin/siklus" enctype="multipart/form-data">
        ${daftarGalat(galatSiklus)}
        <label>Berkas siklus (.json, maksimal 512 KB)
          <input type="file" name="file" accept=".json,application/json" required>
        </label>
        <label class="cek"><input type="checkbox" name="timpa" value="1"> Timpa jika nomor sudah ada</label>
        <button class="tombol" type="submit">Unggah siklus</button>
        <p class="muted" style="margin:0;font-size:13px">Satu berkas berisi satu siklus: no, produksi, kirim, pembeli, ekor, penjualan, biaya, dan langkah. Contoh format ada di README.</p>
      </form>
      ${daftar.length === 0
        ? html`<p class="muted">Belum ada siklus.</p>`
        : html`<div class="panel gulir"><table>
          <thead><tr><th>Siklus</th><th>Produksi</th><th>Pembeli</th><th></th></tr></thead>
          <tbody>${daftar.map(
            (s) => html`<tr><td><a href="/siklus/${s.no}">Siklus ${s.no}</a></td><td>${tgl(s.produksi)}</td><td>${s.pembeli}</td><td class="r"><form method="post" action="/admin/siklus/${s.no}/hapus"><button class="tombol bahaya" type="submit">Hapus</button></form></td></tr>`,
          )}</tbody></table></div>`}
    </section>
    <section><p class="eyebrow">Dana investor</p><h2>Tambah dana</h2>
      <form class="isian panel" method="post" action="/admin/dana">
        ${daftarGalat(galatDana)}
        <label>Tanggal diterima <input type="date" name="tanggal" required></label>
        <label>Jumlah (rupiah) <input type="text" name="jumlah" inputmode="numeric" placeholder="1.367.000.000" maxlength="20" required></label>
        <label>Keterangan (opsional) <input type="text" name="keterangan" maxlength="200"></label>
        <button class="tombol" type="submit">Tambah dana</button>
      </form>
      ${dana.length === 0
        ? html`<p class="muted">Belum ada dana.</p>`
        : html`<div class="panel gulir"><table>
          <thead><tr><th>Tanggal</th><th>Keterangan</th><th class="r">Jumlah</th><th></th></tr></thead>
          <tbody>${dana.map(
            (d) => html`<tr><td>${tgl(d.tanggal)}</td><td>${d.keterangan}</td><td class="r">${rp(d.jumlah)}</td><td class="r"><form method="post" action="/admin/dana/${d.id}/hapus"><button class="tombol bahaya" type="submit">Hapus</button></form></td></tr>`,
          )}</tbody></table></div>`}
    </section>`;

  return shell({
    judul: 'Kelola',
    heading: 'Kelola data',
    lead: 'Tambah, timpa, atau hapus siklus produksi, dan catat dana investor.',
    nav: navSiklus(daftar, 'admin'),
    peran: 'admin',
    isi,
  });
}
