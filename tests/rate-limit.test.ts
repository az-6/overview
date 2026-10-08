import { expect, it } from 'vitest';
import { createLoginLimiter } from '../src/rate-limit';

const make = () => {
  let t = 0;
  const limiter = createLoginLimiter({ now: () => t });
  return { limiter, advance: (ms: number) => { t += ms; } };
};

it('memblokir pada kegagalan kelima, bukan sebelumnya', () => {
  const { limiter } = make();
  for (let i = 0; i < 4; i += 1) limiter.recordFailure('ip-1');
  expect(limiter.isBlocked('ip-1')).toBe(false);
  limiter.recordFailure('ip-1');
  expect(limiter.isBlocked('ip-1')).toBe(true);
});

it('membuka blokir setelah 15 menit sejak kegagalan pertama', () => {
  const { limiter, advance } = make();
  for (let i = 0; i < 5; i += 1) limiter.recordFailure('ip-1');
  advance(15 * 60_000 - 1);
  expect(limiter.isBlocked('ip-1')).toBe(true);
  expect(limiter.retryAfterSeconds('ip-1')).toBe(1);
  advance(1);
  expect(limiter.isBlocked('ip-1')).toBe(false);
});

it('menghitung per kunci dan reset menghapus hitungan', () => {
  const { limiter } = make();
  for (let i = 0; i < 5; i += 1) limiter.recordFailure('ip-1');
  expect(limiter.isBlocked('ip-2')).toBe(false);
  limiter.reset('ip-1');
  expect(limiter.isBlocked('ip-1')).toBe(false);
});

it('tidak menumpuk memori tanpa batas', () => {
  const { limiter, advance } = make();
  for (let i = 0; i < 1500; i += 1) limiter.recordFailure(`ip-${i}`);
  advance(16 * 60_000);
  limiter.recordFailure('baru');
  expect(limiter.isBlocked('ip-0')).toBe(false);
});
