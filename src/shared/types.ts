export type SitemapNodeStatus = 'pending' | 'success' | 'error' | 'skipped';

export type SitemapNode = {
  type: 'sitemap';
  url: string;
  status: SitemapNodeStatus;
  children: TreeNode[];
  error?: string;
};

export type UrlNode = {
  type: 'url';
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
};

export type TreeNode = SitemapNode | UrlNode;

export type CrawlError = {
  url: string;
  message: string;
  code?: string;
};

export type CrawlSummary = {
  rootUrl: string;
  sitemapsDiscovered: number;
  urlsDiscovered: number;
  errors: number;
  durationMs: number;
};

export type CrawlOptions = {
  maxDepth?: number;
  maxSitemaps?: number;
  maxUrls?: number;
  maxCrawlDurationMs?: number;
  maxRequestsPerSecond?: number;
  maxTotalResponseBytes?: number;
};

export type CrawlResult = {
  root: SitemapNode;
  summary: CrawlSummary;
  errors: CrawlError[];
};
