export type CrawlLimits = {
  maxDepth: number;
  maxSitemaps: number;
  maxUrls: number;
  requestTimeoutMs: number;
  maxCrawlDurationMs: number;
  maxResponseBytes: number;
  maxTotalResponseBytes: number;
  concurrency: number;
  maxRequestsPerSecond: number;
};

export const DEFAULT_CRAWL_LIMITS: CrawlLimits = {
  maxDepth: 8,
  maxSitemaps: 100,
  maxUrls: 10_000,
  requestTimeoutMs: 15_000,
  maxCrawlDurationMs: 60_000,
  maxResponseBytes: 10 * 1024 * 1024,
  maxTotalResponseBytes: 25 * 1024 * 1024,
  concurrency: 5,
  maxRequestsPerSecond: 3,
};

export const MAX_CRAWL_LIMITS: CrawlLimits = {
  maxDepth: 8,
  maxSitemaps: 100,
  maxUrls: 10_000,
  requestTimeoutMs: 15_000,
  maxCrawlDurationMs: 60_000,
  maxResponseBytes: 10 * 1024 * 1024,
  maxTotalResponseBytes: 25 * 1024 * 1024,
  concurrency: 5,
  maxRequestsPerSecond: 3,
};
