import type { CrawlOptions } from '../shared/types.js';
import { CONFIGURABLE_CRAWL_OPTION_MAXIMUMS } from '../shared/types.js';

export type CrawlPresetId = 'small' | 'standard' | 'deep';

export type AdvancedCrawlFields = Record<keyof CrawlOptions, string>;

export const CRAWL_PRESETS: Record<CrawlPresetId, { label: string; description: string; options: Required<CrawlOptions> }> = {
  small: {
    label: 'Small',
    description: 'Quick look at compact sitemaps',
    options: { maxDepth: 4, maxSitemaps: 50, maxUrls: 2_500, maxRequestsPerSecond: 3 },
  },
  standard: {
    label: 'Standard',
    description: 'Balanced crawl for most sites',
    options: { maxDepth: 10, maxSitemaps: 250, maxUrls: 25_000, maxRequestsPerSecond: 3 },
  },
  deep: {
    label: 'Deep',
    description: 'Higher limits for large sitemap indexes',
    options: { maxDepth: 15, maxSitemaps: 500, maxUrls: 50_000, maxRequestsPerSecond: 3 },
  },
};

export function buildCrawlOptions(presetId: CrawlPresetId, advancedFields: Partial<AdvancedCrawlFields>): CrawlOptions {
  const options: CrawlOptions = { ...CRAWL_PRESETS[presetId].options };

  for (const key of Object.keys(options) as Array<keyof CrawlOptions>) {
    const parsedValue = parseSupportedInteger(advancedFields[key], CONFIGURABLE_CRAWL_OPTION_MAXIMUMS[key]);
    if (parsedValue !== null) {
      options[key] = parsedValue;
    }
  }

  return options;
}

function parseSupportedInteger(value: string | undefined, maximum: number): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= maximum ? parsed : null;
}
