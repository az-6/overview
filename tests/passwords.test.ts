import { expect, it } from 'vitest';
import { safeEqual } from '../src/passwords';

it('membandingkan sandi', async () => {
  expect(await safeEqual('sama-persis', 'sama-persis')).toBe(true);
  expect(await safeEqual('sama-persis', 'sama-persiS')).toBe(false);
  expect(await safeEqual('pendek', 'jauh-lebih-panjang')).toBe(false);
  expect(await safeEqual('', 'x')).toBe(false);
  expect(await safeEqual('', '')).toBe(true);
});
