// tests/views-layout.test.ts
import { describe, expect, it } from 'vitest';
import { tgl } from '../src/views/format';
import { loginPage, messagePage, navSiklus, shell } from '../src/views/layout';
import { batang, kpi } from '../src/views/widgets';
import { siklusContoh } from './fixtures';

const teks = async (x: unknown) => String(await x);

describe('tgl', () => {
  it('memformat tanggal Indonesia dan menangani kosong', () => {
    expect(tgl('2026-10-03')).toBe('3 Oktober 2026');
    expect(tgl(undefined)).toBe('—');
    expect(tgl('')).toBe('—');
  });
});

describe('shell', () => {
  const dasar = { judul: 'Uji', heading: 'Judul', isi: '<p>isi</p>' };

  it('memuat logo, meta noindex, dan gaya tanpa meng-escape tanda kutip CSS', async () => {
    const h = await teks(shell(dasar));
    expect(h).toContain('<img src="/aset/logo-putih.png"');
    expect(h).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(h).toContain('<title>Uji · Overview</title>');
    expect(h).toMatch(/<style>[^<]*"Segoe UI"/);
    expect(h).not.toMatch(/<script/i);
  });

  it('tanpa peran tidak ada tombol Keluar maupun Kelola', async () => {
    const h = await teks(shell(dasar));
    expect(h).not.toContain('action="/logout"');
    expect(h).not.toContain('/admin');
  });

  it('owner melihat Keluar tetapi tidak ada tautan admin', async () => {
    const h = await teks(shell({ ...dasar, peran: 'owner' }));
    expect(h).toContain('action="/logout"');
    expect(h).not.toContain('/admin');
  });

  it('admin melihat Kelola dan Keluar', async () => {
    const h = await teks(shell({ ...dasar, peran: 'admin' }));
    expect(h).toContain('href="/admin"');
    expect(h).toContain('action="/logout"');
  });

  it('meng-escape judul, heading, label, lead, dan teks navigasi', async () => {
    const jahat = '<b>x</b>';
    const h = await teks(
      shell({ judul: jahat, heading: jahat, label: jahat, lead: jahat, nav: [{ href: '/', teks: jahat, aktif: true }], isi: '' }),
    );
    expect(h).not.toContain('<b>x</b>');
    expect(h).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('menandai navigasi aktif dengan aria-current', async () => {
    const nav = navSiklus([siklusContoh({ no: 1 }), siklusContoh({ no: 2 })], 2);
    expect(nav.map((n) => [n.teks, n.aktif])).toEqual([['Ringkasan', false], ['Siklus 1', false], ['Siklus 2', true]]);
    expect(nav[2].href).toBe('/siklus/2');
    const h = await teks(shell({ ...dasar, nav }));
    expect(h.match(/<a [^>]*aria-current="page"/g)).toHaveLength(1);
  });
});

describe('halaman pesan dan login', () => {
  it('halaman pesan meng-escape isi', async () => {
    const h = await teks(messagePage('Ditolak', '<script>x</script>'));
    expect(h).toContain('Ditolak');
    expect(h).not.toMatch(/<script/i);
  });

  it('login memuat kolom sandi dan meng-escape galat', async () => {
    const h = await teks(loginPage('<i>salah</i>'));
    expect(h).toContain('type="password"');
    expect(h).toContain('action="/login"');
    expect(h).toContain('&lt;i&gt;salah&lt;/i&gt;');
    expect(await teks(loginPage())).not.toContain('role="alert"');
  });
});

describe('widget', () => {
  it('kpi merender label, nilai, dan kelas', async () => {
    const h = await teks(kpi([{ k: 'Laba', v: 'Rp 1', s: 'Margin 1 %', kelas: 'naik' }, { k: '<k>', v: '2', s: '3' }]));
    expect(h).toContain('class="v naik"');
    expect(h).toContain('&lt;k&gt;');
  });

  it('batang membatasi lebar 0 sampai 100, menangani negatif dan null, tanpa NaN', async () => {
    const h = await teks(
      batang(
        [{ label: 'A', v: -0.2 }, { label: 'B', v: 0.5 }, { label: 'C', v: null }, { label: 'D', v: 0 }],
        { format: (v) => (v == null ? '—' : String(v)), target: 0.6 },
      ),
    );
    expect(h).not.toMatch(/NaN|Infinity/);
    for (const [, nilai] of h.matchAll(/(?:width|left):([0-9.]+)%/g)) {
      expect(Number(nilai)).toBeGreaterThanOrEqual(0);
      expect(Number(nilai)).toBeLessThanOrEqual(100);
    }
    expect(h).toContain('isi neg');
    expect(h).toContain('class="target"');
  });

  it('batang dengan semua nilai nol tidak membagi nol', async () => {
    const h = await teks(batang([{ label: 'A', v: 0 }], { format: String }));
    expect(h).not.toMatch(/NaN|Infinity/);
  });
});
