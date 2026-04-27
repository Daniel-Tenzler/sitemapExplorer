import type { CrawlOptions } from '../shared/types.js';
import { CONFIGURABLE_CRAWL_OPTION_MAXIMUMS } from '../shared/types.js';

const crawlOptionKeys = Object.keys(CONFIGURABLE_CRAWL_OPTION_MAXIMUMS) as Array<keyof CrawlOptions>;

export function sanitizeCrawlOptions(value: unknown): CrawlOptions {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const options: CrawlOptions = {};

  for (const key of crawlOptionKeys) {
    const maybeValue = input[key];
    if (isSupportedCrawlOptionValue(key, maybeValue)) {
      options[key] = maybeValue;
    }
  }

  return options;
}

function isSupportedCrawlOptionValue(key: keyof CrawlOptions, value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= CONFIGURABLE_CRAWL_OPTION_MAXIMUMS[key]
  );
}
