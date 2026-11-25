import type { CrawlOptions } from '../shared/types.js';
import { CONFIGURABLE_CRAWL_OPTION_MAXIMUMS } from '../shared/types.js';
import { MAX_CRAWL_LIMITS } from './limits.js';

const crawlOptionKeys: Array<keyof CrawlOptions> = [
  ...Object.keys(CONFIGURABLE_CRAWL_OPTION_MAXIMUMS) as Array<keyof typeof CONFIGURABLE_CRAWL_OPTION_MAXIMUMS>,
  'maxCrawlDurationMs',
  'maxTotalResponseBytes',
];

export function sanitizeCrawlOptions(value: unknown): CrawlOptions {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const options: CrawlOptions = {};

  for (const key of crawlOptionKeys) {
    const maybeValue = input[key];
    if (typeof maybeValue === 'number' && Number.isInteger(maybeValue) && maybeValue > 0) {
      options[key] = Math.min(maybeValue, MAX_CRAWL_LIMITS[key]);
    }
  }

  return options;
}
