import { describe, expect, it } from 'vitest';

import { crawlSitemap } from './sitemapCrawler.js';

describe('crawlSitemap', () => {
  it('recursively crawls sitemap indexes and URL sets', async () => {
    const result = await crawlSitemap('https://example.com/root.xml', {}, { fetcher: fixtureFetcher });

    expect(result.summary.sitemapsDiscovered).toBe(2);
    expect(result.summary.urlsDiscovered).toBe(2);
    expect(result.summary.errors).toBe(0);
    expect(result.root.children).toHaveLength(1);
    expect(result.root.children[0]).toMatchObject({ type: 'sitemap', status: 'success', url: 'https://example.com/pages.xml' });
  });

  it('tries /sitemap.xml when the submitted URL is only a domain', async () => {
    const requestedUrls: string[] = [];
    const result = await crawlSitemap(
      'https://example.com',
      {},
      {
        fetcher: async (url) => {
          requestedUrls.push(url);
          return fixtureFetcher(url);
        },
      },
    );

    expect(requestedUrls[0]).toBe('https://example.com/sitemap.xml');
    expect(result.summary.rootUrl).toBe('https://example.com/sitemap.xml');
    expect(result.summary.urlsDiscovered).toBe(1);
  });

  it('skips cyclic sitemap references', async () => {
    const result = await crawlSitemap('https://example.com/cycle-a.xml', {}, { fetcher: fixtureFetcher });

    expect(result.summary.sitemapsDiscovered).toBe(2);
    expect(result.summary.errors).toBe(1);
    expect(result.errors[0]).toMatchObject({ code: 'DUPLICATE_SITEMAP' });
  });

  it('returns partial results when a nested sitemap fails', async () => {
    const result = await crawlSitemap('https://example.com/broken-index.xml', {}, { fetcher: fixtureFetcher });

    expect(result.root.status).toBe('success');
    expect(result.summary.errors).toBe(1);
    expect(result.root.children).toHaveLength(2);
    expect(result.root.children[1]).toMatchObject({ type: 'sitemap', status: 'error' });
  });

  it('enforces URL limits', async () => {
    const result = await crawlSitemap('https://example.com/pages.xml', { maxUrls: 1 }, { fetcher: fixtureFetcher });

    expect(result.summary.urlsDiscovered).toBe(1);
    expect(result.summary.errors).toBe(1);
    expect(result.errors[0]).toMatchObject({ code: 'LIMIT_URLS' });
  });

  it('rate limits sitemap fetch starts to three requests per second', async () => {
    const startedAt: number[] = [];
    const crawl = crawlSitemap(
      'https://example.com/wide-index.xml',
      { maxRequestsPerSecond: 3 },
      {
        fetcher: async (url) => {
          startedAt.push(Date.now());
          return fixtureFetcher(url);
        },
      },
    );

    const result = await crawl;

    expect(result.summary.sitemapsDiscovered).toBe(5);
    expect(startedAt).toHaveLength(5);
    expect(startedAt[3] - startedAt[0]).toBeGreaterThanOrEqual(900);
  });
});

async function fixtureFetcher(url: string): Promise<string> {
  const fixtures: Record<string, string> = {
    'https://example.com/root.xml': `<sitemapindex><sitemap><loc>https://example.com/pages.xml</loc></sitemap></sitemapindex>`,
    'https://example.com/sitemap.xml': `<urlset><url><loc>https://example.com/home</loc></url></urlset>`,
    'https://example.com/pages.xml': `<urlset>
      <url><loc>https://example.com/a</loc></url>
      <url><loc>https://example.com/b</loc></url>
    </urlset>`,
    'https://example.com/cycle-a.xml': `<sitemapindex><sitemap><loc>https://example.com/cycle-b.xml</loc></sitemap></sitemapindex>`,
    'https://example.com/cycle-b.xml': `<sitemapindex><sitemap><loc>https://example.com/cycle-a.xml</loc></sitemap></sitemapindex>`,
    'https://example.com/broken-index.xml': `<sitemapindex>
      <sitemap><loc>https://example.com/pages.xml</loc></sitemap>
      <sitemap><loc>https://example.com/missing.xml</loc></sitemap>
    </sitemapindex>`,
    'https://example.com/wide-index.xml': `<sitemapindex>
      <sitemap><loc>https://example.com/one.xml</loc></sitemap>
      <sitemap><loc>https://example.com/two.xml</loc></sitemap>
      <sitemap><loc>https://example.com/three.xml</loc></sitemap>
      <sitemap><loc>https://example.com/four.xml</loc></sitemap>
    </sitemapindex>`,
    'https://example.com/one.xml': '<urlset></urlset>',
    'https://example.com/two.xml': '<urlset></urlset>',
    'https://example.com/three.xml': '<urlset></urlset>',
    'https://example.com/four.xml': '<urlset></urlset>',
  };

  const fixture = fixtures[url];
  if (!fixture) {
    throw new Error('Fixture not found.');
  }

  return fixture;
}
