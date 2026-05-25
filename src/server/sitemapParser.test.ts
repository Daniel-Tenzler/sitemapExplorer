import { describe, expect, it } from 'vitest';

import { parseSitemapXml } from './sitemapParser.js';

describe('parseSitemapXml', () => {
  it('parses sitemap indexes with relative child URLs', () => {
    const parsed = parseSitemapXml(
      `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>/sitemap-pages.xml</loc><lastmod>2026-04-24</lastmod></sitemap>
      </sitemapindex>`,
      'https://example.com/sitemap.xml',
    );

    expect(parsed).toEqual({
      kind: 'sitemapindex',
      sitemaps: [{ loc: 'https://example.com/sitemap-pages.xml', lastmod: '2026-04-24', changefreq: undefined, priority: undefined }],
    });
  });

  it('parses URL sets with optional metadata', () => {
    const parsed = parseSitemapXml(
      `<urlset>
        <url>
          <loc>https://example.com/page</loc>
          <lastmod>2026-04-24</lastmod>
          <changefreq>daily</changefreq>
          <priority>0.8</priority>
        </url>
      </urlset>`,
      'https://example.com/sitemap.xml',
    );

    expect(parsed).toEqual({
      kind: 'urlset',
      urls: [
        {
          loc: 'https://example.com/page',
          lastmod: '2026-04-24',
          changefreq: 'daily',
          priority: '0.8',
        },
      ],
    });
  });

  it('rejects XML that is not a sitemap', () => {
    expect(() => parseSitemapXml('<html><body>Nope</body></html>', 'https://example.com/sitemap.xml')).toThrow(
      'neither a sitemapindex nor a urlset',
    );
  });

  it('filters non-http loc values', () => {
    const parsed = parseSitemapXml(
      `<urlset>
        <url><loc>javascript:alert(1)</loc></url>
        <url><loc>https://example.com/safe</loc></url>
      </urlset>`,
      'https://example.com/sitemap.xml',
    );

    expect(parsed).toEqual({
      kind: 'urlset',
      urls: [
        {
          loc: 'https://example.com/safe',
          lastmod: undefined,
          changefreq: undefined,
          priority: undefined,
        },
      ],
    });
  });

  it('rejects URL sets over the configured URL limit before parsing', () => {
    expect(() =>
      parseSitemapXml(
        `<urlset>
          <url><loc>https://example.com/a</loc></url>
          <url><loc>https://example.com/b</loc></url>
        </urlset>`,
        'https://example.com/sitemap.xml',
        { maxUrls: 1, maxSitemaps: 10 },
      ),
    ).toThrow('more URL entries than the configured limit');
  });

  it('rejects sitemap indexes over the configured sitemap limit before parsing', () => {
    expect(() =>
      parseSitemapXml(
        `<sitemapindex>
          <sitemap><loc>https://example.com/a.xml</loc></sitemap>
          <sitemap><loc>https://example.com/b.xml</loc></sitemap>
        </sitemapindex>`,
        'https://example.com/sitemap.xml',
        { maxUrls: 10, maxSitemaps: 1 },
      ),
    ).toThrow('more sitemap entries than the configured limit');
  });
});
