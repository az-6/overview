// src/views/layout.ts
import { html, raw } from 'hono/html';
import type { Role } from '../session.js';
import type { Siklus } from '../siklus/types.js';

// Gaya diambil dari investor/index.html; font sistem (tanpa Google Fonts) karena CSP melarang sumber luar.
const styles = `
:root{
  --bg:#f5f8fa;--surface:#fff;--ink:#0f2433;--muted:#5a6f7d;--line:#d9e3ea;
  --laut:#0a6b9e;--laut-muda:#e3f0f7;--naik:#1f7a4d;--turun:#b4442f;--turun-muda:#f8e7e3;
  --sans:system-ui,-apple-system,"Segoe UI",sans-serif;
  --serif:Georgia,"Times New Roman",serif;--mono:ui-monospace,Menlo,Consolas,monospace;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#08151e;--surface:#0f2130;--ink:#e4edf3;--muted:#93a8b6;--line:#20384a;
  --laut:#4fb0e3;--laut-muda:#123047;--naik:#5cc48f;--turun:#ec8a74;--turun-muda:#3a1e19;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 var(--sans)}
a{color:var(--laut)}
.pita{background:linear-gradient(135deg,#06324d,#0a6b9e);color:#fff;padding-inline:16px}
.pita-isi{max-width:960px;margin:0 auto;padding-block:24px 44px}
.pita img{height:40px;display:block}
.atas{display:flex;justify-content:space-between;align-items:center;gap:12px}
.aksi{display:flex;gap:8px;align-items:center}
.aksi form{margin:0}
.aksi a,.aksi button{color:#fff;background:none;font:500 13px/1 var(--mono);padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.35);text-decoration:none;cursor:pointer}
.pita nav{display:flex;flex-wrap:wrap;gap:6px;margin-top:24px}
.pita nav a{color:#fff;text-decoration:none;font:500 13px/1 var(--mono);padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.35)}
.pita nav a[aria-current="page"]{background:#fff;color:#06324d;border-color:#fff}
.label{font:500 12px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;opacity:.8;margin:28px 0 10px}
h1{font:500 clamp(28px,5vw,40px)/1.15 var(--serif);margin:0;text-wrap:balance}
.pita p.lead{max-width:62ch;margin:12px 0 0;opacity:.88}
main{max-width:960px;margin:0 auto;padding-inline:16px;padding-block:0 64px;display:flex;flex-direction:column;gap:48px}
main.polos{padding-block-start:32px}
section{display:flex;flex-direction:column;gap:16px;min-width:0}
h2{font:600 21px/1.3 var(--sans);margin:0;text-wrap:balance}
.eyebrow{font:500 12px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--laut);margin:0}
.muted{color:var(--muted)}
.kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-top:-28px}
.kpi div{background:var(--surface);padding:16px 18px;display:flex;flex-direction:column;gap:4px;min-width:0}
.kpi .k,.kpi .s{font-size:13px;color:var(--muted)}
.kpi .v{font:500 23px/1.2 var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.v.naik{color:var(--naik)}.v.turun,.turun{color:var(--turun)}
@media (max-width:760px){.kpi{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:420px){.kpi{grid-template-columns:minmax(0,1fr)}}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px;min-width:0}
.gulir{overflow-x:auto;position:relative}
table{width:100%;border-collapse:collapse;font-size:14px}
th{font-weight:500;color:var(--muted);text-align:left;font-size:13px;border-bottom:1px solid var(--line);padding:8px 10px;white-space:nowrap}
td{padding:9px 10px;border-bottom:1px solid var(--line)}
.r{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
tr.total td{font-weight:600;border-bottom:none;border-top:1.5px solid var(--ink)}
.hbar{display:flex;flex-direction:column;gap:8px}
.hbar .row{display:grid;grid-template-columns:90px minmax(0,1fr) 90px;gap:10px;align-items:center;font-size:14px}
.hbar .trak{position:relative;height:16px;background:var(--laut-muda);border-radius:3px}
.hbar .isi{position:absolute;top:0;bottom:0;background:var(--laut);border-radius:3px}
.hbar .isi.neg{background:var(--turun)}
.hbar .nol{position:absolute;top:-3px;bottom:-3px;border-left:1.5px solid var(--muted)}
.hbar .target{position:absolute;top:-3px;bottom:-3px;border-left:1.5px dashed var(--turun)}
.dua{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
@media (max-width:760px){.dua{grid-template-columns:minmax(0,1fr)}}
.yield{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(6px,1fr);gap:4px;align-items:end;height:190px;position:relative;padding-top:18px;min-width:max(100%,var(--lebar))}
.yield .b{background:var(--laut);border-radius:3px 3px 0 0;position:relative}
.yield .b.c{background:var(--muted)}
.yield .b span{position:absolute;top:-17px;left:50%;transform:translateX(-50%);font:500 11px/1 var(--mono);white-space:nowrap}
.yield .garis{position:absolute;left:0;right:0;border-top:1.5px dashed var(--turun);z-index:1;pointer-events:none}
.yx{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(6px,1fr);gap:4px;margin-top:6px;font:11px/1.3 var(--mono);color:var(--muted);text-align:center;min-width:max(100%,var(--lebar))}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--muted);margin-top:10px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}
.biaya .row{grid-template-columns:130px minmax(0,1fr) 160px}
@media (max-width:520px){.hbar .row,.biaya .row{grid-template-columns:minmax(0,1fr) auto}.hbar .trak{grid-column:1/-1;order:3}}
.langkah{list-style:none;margin:0;padding:0}
.langkah li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 16px;padding:12px 0;border-bottom:1px solid var(--line)}
.langkah li:last-child{border-bottom:none}
.langkah p{margin:0;color:var(--muted);font-size:14px}
.chip{grid-row:1;grid-column:2;font:500 11px/1 var(--mono);text-transform:uppercase;letter-spacing:.06em;padding:6px 8px;border-radius:999px;align-self:start}
.chip.selesai{background:var(--laut-muda);color:var(--laut)}.chip.berjalan{background:var(--turun-muda);color:var(--turun)}
.antar{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:14px}
.galat{background:var(--turun-muda);color:var(--turun);border-radius:10px;padding:16px 18px;font-weight:500}
.galat ul{margin:0;padding-left:18px}
.sukses{background:var(--laut-muda);color:var(--laut);border-radius:10px;padding:12px 16px;font-weight:500;margin:0}
.dana{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.dana div{display:flex;flex-direction:column;gap:4px;min-width:0}
.dana .k{font-size:13px;color:var(--muted)}.dana .v{font:500 20px/1.2 var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
@media (max-width:760px){.dana{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:420px){.dana{grid-template-columns:minmax(0,1fr)}}
.pakai{height:12px;background:var(--laut-muda);border-radius:3px;overflow:hidden;margin-top:16px}.pakai div{height:100%;background:var(--laut)}
.kepala-bagian{display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap}
.tombol{display:inline-block;background:var(--laut);color:#fff;text-decoration:none;font:500 14px/1 var(--sans);padding:11px 16px;border-radius:8px;border:0;cursor:pointer}
.tombol.bahaya{background:var(--turun)}
form.isian{display:grid;gap:12px;max-width:520px}
label{display:grid;gap:4px;font-weight:500}
label.cek{display:flex;gap:8px;align-items:center;font-weight:400}
input[type=text],input[type=password],input[type=date],input[type=file]{font:inherit;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}
`;

export interface NavItem {
  href: string;
  teks: string;
  aktif: boolean;
}

export const navSiklus = (daftar: Siklus[], aktif: 'ringkasan' | 'admin' | number): NavItem[] => [
  { href: '/', teks: 'Ringkasan', aktif: aktif === 'ringkasan' },
  ...daftar.map((s) => ({ href: `/siklus/${s.no}`, teks: `Siklus ${s.no}`, aktif: aktif === s.no })),
];

export interface ShellInput {
  judul: string;
  heading: string;
  label?: string;
  lead?: string;
  nav?: NavItem[];
  peran?: Role | null;
  isi: unknown;
  polos?: boolean;
}

export const shell = ({ judul, heading, label, lead, nav, peran, isi, polos }: ShellInput) => html`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${judul} · Overview</title>
<style>${raw(styles)}</style>
</head>
<body>
<header class="pita"><div class="pita-isi">
  <div class="atas">
    <a href="/"><img src="/aset/logo-putih.png" alt="PT. Katalis Lintas Global"></a>
    <div class="aksi">${peran === 'admin' ? html`<a href="/admin">Kelola</a>` : ''}${peran ? html`<form method="post" action="/logout"><button type="submit">Keluar</button></form>` : ''}</div>
  </div>
  ${nav ? html`<nav aria-label="Siklus">${nav.map((n) => html`<a href="${n.href}"${n.aktif ? raw(' aria-current="page"') : ''}>${n.teks}</a>`)}</nav>` : ''}
  ${label ? html`<p class="label">${label}</p>` : ''}
  <h1>${heading}</h1>
  ${lead ? html`<p class="lead">${lead}</p>` : ''}
</div></header>
<main${polos ? raw(' class="polos"') : ''}>${isi}</main>
</body>
</html>`;

export const messagePage = (judul: string, teks: string) =>
  shell({ judul, heading: judul, isi: html`<p>${teks}</p><p><a href="/">Kembali</a></p>`, polos: true });

export const loginPage = (galat?: string) =>
  shell({
    judul: 'Masuk',
    heading: 'Masuk',
    polos: true,
    isi: html`
      ${galat ? html`<p class="galat" role="alert">${galat}</p>` : ''}
      <form class="isian" method="post" action="/login">
        <label>Sandi
          <input type="password" name="password" autocomplete="current-password" maxlength="200" required autofocus>
        </label>
        <button class="tombol" type="submit">Masuk</button>
      </form>`,
  });
