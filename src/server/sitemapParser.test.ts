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
});
