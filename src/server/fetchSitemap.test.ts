import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { gunzipLimited, isBlockedAddress } from './fetchSitemap.js';

describe('fetchSitemap safety helpers', () => {
  it('blocks private, loopback, metadata, mapped, and documentation addresses', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true);
    expect(isBlockedAddress('10.0.0.7')).toBe(true);
    expect(isBlockedAddress('172.20.0.1')).toBe(true);
    expect(isBlockedAddress('192.168.1.10')).toBe(true);
    expect(isBlockedAddress('169.254.169.254')).toBe(true);
    expect(isBlockedAddress('100.64.0.1')).toBe(true);
    expect(isBlockedAddress('192.0.2.1')).toBe(true);
    expect(isBlockedAddress('::1')).toBe(true);
    expect(isBlockedAddress('fe80::1')).toBe(true);
    expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedAddress('2001:db8::1')).toBe(true);
    expect(isBlockedAddress('93.184.216.34')).toBe(false);
    expect(isBlockedAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
  });

  it('enforces decompressed gzip size while streaming', async () => {
    const compressed = gzipSync('x'.repeat(128));

    await expect(gunzipLimited(compressed, 32)).rejects.toThrow('Response too large.');
  });
});
