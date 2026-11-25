import { describe, expect, it } from 'vitest';

import { CRAWL_PRESETS, buildCrawlOptions } from './crawlOptions.js';

describe('buildCrawlOptions', () => {
  it('uses selected preset limits when advanced fields are not provided', () => {
    expect(buildCrawlOptions('small', {})).toEqual(CRAWL_PRESETS.small.options);
  });

  it('overrides preset limits with positive advanced field values', () => {
    expect(buildCrawlOptions('standard', { maxDepth: '4', maxSitemaps: '25', maxUrls: '500', maxRequestsPerSecond: '2' })).toEqual({
      maxDepth: 4,
      maxSitemaps: 25,
      maxUrls: 500,
      maxRequestsPerSecond: 2,
    });
  });

  it('ignores empty and invalid advanced field values', () => {
    expect(buildCrawlOptions('deep', { maxDepth: '', maxSitemaps: '0', maxUrls: '-1', maxRequestsPerSecond: '1.5' })).toEqual(
      CRAWL_PRESETS.deep.options,
    );
  });

  it('ignores advanced field values above supported limits', () => {
    expect(buildCrawlOptions('standard', { maxDepth: '9', maxSitemaps: '101', maxUrls: '10001', maxRequestsPerSecond: '4' })).toEqual(
      CRAWL_PRESETS.standard.options,
    );
  });

  it('ignores overflow values that cannot be represented as finite numbers', () => {
    expect(buildCrawlOptions('small', { maxDepth: '9'.repeat(309) })).toEqual(CRAWL_PRESETS.small.options);
  });
});
