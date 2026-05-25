import { describe, expect, it } from 'vitest';

import { isAllowedSitemapHost, readPositiveIntegerEnv } from './accessControl.js';

describe('access control helpers', () => {
  it('allows all sitemap hosts when no allow-list is configured', () => {
    expect(isAllowedSitemapHost('https://example.com/sitemap.xml', [])).toBe(true);
  });

  it('allows exact and subdomain matches from the sitemap host allow-list', () => {
    expect(isAllowedSitemapHost('https://example.com/sitemap.xml', ['example.com'])).toBe(true);
    expect(isAllowedSitemapHost('https://www.example.com/sitemap.xml', ['example.com'])).toBe(true);
  });

  it('blocks unrelated or malformed sitemap hosts when an allow-list is configured', () => {
    expect(isAllowedSitemapHost('https://attacker.example.net/sitemap.xml', ['example.com'])).toBe(false);
    expect(isAllowedSitemapHost('not a url', ['example.com'])).toBe(false);
  });

  it('clamps positive integer environment overrides', () => {
    process.env.TEST_SECURITY_LIMIT = '5000';

    expect(readPositiveIntegerEnv('TEST_SECURITY_LIMIT', 10, 100)).toBe(100);

    delete process.env.TEST_SECURITY_LIMIT;
  });
});
