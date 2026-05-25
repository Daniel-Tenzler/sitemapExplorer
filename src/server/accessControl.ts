export function readCsvEnv(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function readPositiveIntegerEnv(name: string, fallback: number, max: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return Math.min(value, max);
}

export function isAllowedSitemapHost(value: string, allowedHosts: string[]): boolean {
  if (allowedHosts.length === 0) {
    return true;
  }

  let hostname: string;
  try {
    hostname = new URL(value).hostname.toLowerCase();
  } catch {
    return false;
  }

  return allowedHosts.some((allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`));
}
