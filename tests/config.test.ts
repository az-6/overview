import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config';

const valid = {
  ADMIN_PASSWORD: 'admin-password-123',
  VIEWER_PASSWORD: 'viewer-password-123',
  SESSION_SECRET: 's'.repeat(32),
};

describe('loadConfig', () => {
  it('membaca konfigurasi yang valid', () => {
    expect(loadConfig(valid)).toEqual({
      adminPassword: valid.ADMIN_PASSWORD,
      viewerPassword: valid.VIEWER_PASSWORD,
      sessionSecret: valid.SESSION_SECRET,
    });
  });

  it.each([
    ['ADMIN_PASSWORD hilang', { ...valid, ADMIN_PASSWORD: undefined }, 'ADMIN_PASSWORD'],
    ['VIEWER_PASSWORD terlalu pendek', { ...valid, VIEWER_PASSWORD: 'pendek' }, 'VIEWER_PASSWORD'],
    ['SESSION_SECRET 31 karakter', { ...valid, SESSION_SECRET: 's'.repeat(31) }, 'SESSION_SECRET'],
    ['SESSION_SECRET kosong', { ...valid, SESSION_SECRET: '' }, 'SESSION_SECRET'],
    ['kedua sandi sama', { ...valid, VIEWER_PASSWORD: valid.ADMIN_PASSWORD }, 'berbeda'],
  ])('menolak: %s', (_label, env, mention) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(mention);
  });

  it('mengumpulkan semua masalah sekaligus dan tidak membocorkan nilai', () => {
    try {
      loadConfig({ ADMIN_PASSWORD: 'rahasia-9', VIEWER_PASSWORD: undefined, SESSION_SECRET: 'x' });
      expect.unreachable();
    } catch (error) {
      const config = error as ConfigError;
      expect(config.problems).toHaveLength(3);
      expect(config.message).not.toContain('rahasia-9');
    }
  });
});
