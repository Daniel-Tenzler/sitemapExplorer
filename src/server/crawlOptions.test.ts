import { describe, expect, it } from 'vitest';

import { sanitizeCrawlOptions } from './crawlOptions.js';

describe('sanitizeCrawlOptions', () => {
  it('keeps valid configurable crawl options', () => {
    expect(sanitizeCrawlOptions({ maxDepth: 4, maxSitemaps: 25, maxUrls: 500, maxRequestsPerSecond: 2 })).toEqual({
      maxDepth: 4,
      maxSitemaps: 25,
      maxUrls: 500,
      maxRequestsPerSecond: 2,
    });
  });

  it('drops invalid fields without discarding the whole options object', () => {
    expect(sanitizeCrawlOptions({ maxDepth: 4, maxSitemaps: null, maxUrls: 500, maxRequestsPerSecond: Infinity })).toEqual({
      maxDepth: 4,
      maxUrls: 500,
    });
  });

  it('clamps values to the server limits', () => {
    expect(
      sanitizeCrawlOptions({
        maxDepth: 51,
        maxSitemaps: 5_001,
        maxUrls: 500_001,
        maxRequestsPerSecond: 21,
        maxCrawlDurationMs: 120_000,
        maxTotalResponseBytes: 50 * 1024 * 1024,
        concurrency: 10,
      }),
    ).toEqual({
      maxDepth: 8,
      maxSitemaps: 100,
      maxUrls: 10_000,
      maxRequestsPerSecond: 3,
      maxCrawlDurationMs: 60_000,
      maxTotalResponseBytes: 25 * 1024 * 1024,
    });
  });
});
