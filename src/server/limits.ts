export type CrawlLimits = {
  maxDepth: number;
  maxSitemaps: number;
  maxUrls: number;
  requestTimeoutMs: number;
  maxResponseBytes: number;
  concurrency: number;
  maxRequestsPerSecond: number;
};

export const DEFAULT_CRAWL_LIMITS: CrawlLimits = {
  maxDepth: 15,
  maxSitemaps: 500,
  maxUrls: 50_000,
  requestTimeoutMs: 15_000,
  maxResponseBytes: 50 * 1024 * 1024,
  concurrency: 5,
  maxRequestsPerSecond: 3,
};
