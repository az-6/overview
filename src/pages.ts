import { html } from 'hono/html';
import type { ReportMeta } from './store/types';

const dateFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

const styles = `
  :root { color-scheme: light; font-family: system-ui, sans-serif; color: #101820; }
  body { margin: 0; background: #f5fbfd; }
  main { max-width: 52rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
  h1 { font-size: 1.5rem; margin: 0 0 1rem; }
  header.bar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 2rem; }
  header.bar nav { display: flex; gap: 1rem; align-items: center; }
  a { color: #056988; }
  button, input[type=submit] { font: inherit; padding: .6rem 1rem; border: 0; border-radius: .5rem; background: #061a2f; color: #fff; cursor: pointer; }
  button.link { background: none; color: #056988; padding: 0; text-decoration: underline; }
  label { display: grid; gap: .35rem; margin-bottom: 1rem; font-weight: 600; }
  input[type=password], input[type=text], input[type=file] { font: inherit; padding: .6rem; border: 1px solid #d7e2e8; border-radius: .5rem; background: #fff; }
  ul.reports { list-style: none; padding: 0; margin: 0; display: grid; gap: .75rem; }
  ul.reports li { background: #fff; border: 1px solid #d7e2e8; border-radius: .75rem; padding: 1rem; display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
  small { color: #52616e; display: block; }
  .error { color: #9b1c1c; } .ok { color: #14785f; }
  iframe { width: 100%; height: 85vh; border: 1px solid #d7e2e8; border-radius: .5rem; background: #fff; }
`;

const layout = (title: string, body: unknown) => html`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} · Overview</title>
<style>${styles}</style>
</head>
<body><main>${body}</main></body>
</html>`;

const logoutForm = html`<form method="post" action="/logout"><button class="link" type="submit">Keluar</button></form>`;

export const messagePage = (title: string, text: string) =>
  layout(title, html`<h1>${title}</h1><p>${text}</p><p><a href="/">Kembali</a></p>`);

export const loginPage = (error?: string) =>
  layout('Masuk', html`
    <h1>Masuk</h1>
    ${error ? html`<p class="error" role="alert">${error}</p>` : ''}
    <form method="post" action="/login">
      <label>Sandi
        <input type="password" name="password" autocomplete="current-password" maxlength="200" required autofocus>
      </label>
      <button type="submit">Masuk</button>
    </form>`);

export const listPage = ({ reports, isAdmin }: { reports: ReportMeta[]; isAdmin: boolean }) =>
  layout('Laporan', html`
    <header class="bar"><h1>Laporan</h1><nav>${isAdmin ? html`<a href="/admin">Kelola</a>` : ''}${logoutForm}</nav></header>
    ${reports.length === 0
      ? html`<p>Belum ada laporan.</p>`
      : html`<ul class="reports">${reports.map((report) => html`
          <li><span><a href="/r/${report.id}">${report.title}</a><small>${formatDate(report.uploadedAt)}</small></span></li>`)}</ul>`}`);

export const viewerPage = (meta: ReportMeta) =>
  layout(meta.title, html`
    <header class="bar"><h1>${meta.title}</h1><nav><a href="/">Semua laporan</a>${logoutForm}</nav></header>
    <iframe src="/raw/${meta.id}" sandbox="allow-scripts" referrerpolicy="no-referrer" title="${meta.title}"></iframe>`);

export const adminPage = ({ reports, message, error }: { reports: ReportMeta[]; message?: string; error?: string }) =>
  layout('Kelola laporan', html`
    <header class="bar"><h1>Kelola laporan</h1><nav><a href="/">Daftar</a>${logoutForm}</nav></header>
    ${message ? html`<p class="ok" role="status">${message}</p>` : ''}
    ${error ? html`<p class="error" role="alert">${error}</p>` : ''}
    <form method="post" action="/admin/reports" enctype="multipart/form-data">
      <label>Judul laporan <input type="text" name="title" maxlength="120" required></label>
      <label>Berkas HTML (maksimal 4 MB) <input type="file" name="file" accept=".html,.htm,text/html" required></label>
      <button type="submit">Unggah</button>
    </form>
    <h2>Laporan tersimpan</h2>
    ${reports.length === 0
      ? html`<p>Belum ada laporan.</p>`
      : html`<ul class="reports">${reports.map((report) => html`
          <li>
            <span><a href="/r/${report.id}">${report.title}</a><small>${formatDate(report.uploadedAt)}</small></span>
            <form method="post" action="/admin/reports/${report.id}/delete"><button type="submit">Hapus</button></form>
          </li>`)}</ul>`}`);
