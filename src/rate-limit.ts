export interface LoginLimiter {
  isBlocked(key: string): boolean;
  recordFailure(key: string): void;
  reset(key: string): void;
  retryAfterSeconds(key: string): number;
}

interface Options {
  max?: number;
  windowMs?: number;
  now?: () => number;
}

const PRUNE_THRESHOLD = 1000;

// Disimpan di memori instance: best effort. Perlindungan utama tetap panjang sandi dan aturan Firewall.
export function createLoginLimiter({ max = 5, windowMs = 15 * 60_000, now = Date.now }: Options = {}): LoginLimiter {
  const entries = new Map<string, { count: number; start: number }>();

  const live = (key: string) => {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (now() - entry.start >= windowMs) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };

  const prune = () => {
    for (const key of [...entries.keys()]) live(key);
  };

  return {
    isBlocked: (key) => (live(key)?.count ?? 0) >= max,
    recordFailure(key) {
      if (entries.size > PRUNE_THRESHOLD) prune();
      const entry = live(key);
      if (entry) entry.count += 1;
      else entries.set(key, { count: 1, start: now() });
    },
    reset: (key) => void entries.delete(key),
    retryAfterSeconds(key) {
      const entry = live(key);
      return entry ? Math.max(1, Math.ceil((entry.start + windowMs - now()) / 1000)) : 0;
    },
  };
}
