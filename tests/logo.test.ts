// tests/logo.test.ts
import { expect, it } from 'vitest';
import { LOGO_PNG_BASE64 } from '../src/assets/logo';

it('logo adalah berkas PNG yang utuh', () => {
  const bytes = Buffer.from(LOGO_PNG_BASE64, 'base64');
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(bytes.length).toBeGreaterThan(1000);
});
