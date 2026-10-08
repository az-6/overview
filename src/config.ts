export interface Config {
  adminPassword: string;
  viewerPassword: string;
  sessionSecret: string;
}

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Konfigurasi tidak valid: ${problems.join('; ')}`);
    this.name = 'ConfigError';
  }
}

type Env = Record<string, string | undefined>;

// Pesan hanya memuat nama variabel dan aturan, tidak pernah nilainya.
export function loadConfig(env: Env): Config {
  const problems: string[] = [];
  const read = (name: string, minLength: number) => {
    const value = env[name] ?? '';
    if (value.length < minLength) problems.push(`${name} wajib diisi, minimal ${minLength} karakter`);
    return value;
  };

  const adminPassword = read('ADMIN_PASSWORD', 12);
  const viewerPassword = read('VIEWER_PASSWORD', 12);
  const sessionSecret = read('SESSION_SECRET', 32);
  if (adminPassword && adminPassword === viewerPassword) {
    problems.push('ADMIN_PASSWORD dan VIEWER_PASSWORD harus berbeda');
  }

  if (problems.length > 0) throw new ConfigError(problems);
  return { adminPassword, viewerPassword, sessionSecret };
}
