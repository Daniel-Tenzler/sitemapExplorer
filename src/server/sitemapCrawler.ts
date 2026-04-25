import type { CrawlError, CrawlOptions, CrawlResult, SitemapNode, TreeNode, UrlNode } from '../shared/types.js';

import { DEFAULT_CRAWL_LIMITS } from './limits.js';
import { fetchSitemap, type FetchSitemap } from './fetchSitemap.js';
import { parseSitemapXml } from './sitemapParser.js';
import { normalizeInitialSitemapUrl, normalizeSitemapUrl } from './urlUtils.js';

type CrawlDeps = {
  fetcher?: FetchSitemap;
};

type CrawlState = {
  visitedSitemaps: Set<string>;
  sitemapCount: number;
  urlCount: number;
  errors: CrawlError[];
  limits: typeof DEFAULT_CRAWL_LIMITS;
  fetcher: FetchSitemap;
};

export async function crawlSitemap(url: string, options: CrawlOptions = {}, deps: CrawlDeps = {}): Promise<CrawlResult> {
  const startedAt = Date.now();
  const rootUrl = normalizeInitialSitemapUrl(url);
  const limits = { ...DEFAULT_CRAWL_LIMITS, ...options };
  const state: CrawlState = {
    visitedSitemaps: new Set(),
    sitemapCount: 0,
    urlCount: 0,
    errors: [],
    limits,
    fetcher: createRateLimitedFetcher(deps.fetcher ?? fetchSitemap, limits.maxRequestsPerSecond),
  };

  const root = await crawlSitemapNode(rootUrl, 0, state);

  return {
    root,
    summary: {
      rootUrl,
      sitemapsDiscovered: state.sitemapCount,
      urlsDiscovered: state.urlCount,
      errors: state.errors.length,
      durationMs: Date.now() - startedAt,
    },
    errors: state.errors,
  };
}

async function crawlSitemapNode(url: string, depth: number, state: CrawlState): Promise<SitemapNode> {
  const node: SitemapNode = {
    type: 'sitemap',
    url,
    status: 'pending',
    children: [],
  };

  if (depth > state.limits.maxDepth) {
    return markSkipped(node, state, 'Maximum sitemap depth exceeded.', 'LIMIT_DEPTH');
  }

  if (state.visitedSitemaps.has(url)) {
    return markSkipped(node, state, 'Duplicate or cyclic sitemap reference skipped.', 'DUPLICATE_SITEMAP');
  }

  if (state.sitemapCount >= state.limits.maxSitemaps) {
    return markSkipped(node, state, 'Maximum sitemap count exceeded.', 'LIMIT_SITEMAPS');
  }

  state.visitedSitemaps.add(url);
  state.sitemapCount += 1;

  try {
    const xml = await state.fetcher(url);
    const parsed = parseSitemapXml(xml, url);

    if (parsed.kind === 'urlset') {
      node.children = parsed.urls.map((entry) => toUrlNode(entry, state)).filter((child): child is UrlNode => child !== null);
      node.status = 'success';
      return node;
    }

    const childUrls = parsed.sitemaps.map((entry) => entry.loc);
    node.children = await mapWithConcurrency(childUrls, state.limits.concurrency, async (childUrl) => {
      let normalizedChildUrl: string;

      try {
        normalizedChildUrl = normalizeSitemapUrl(childUrl, url);
      } catch (error) {
        return errorNode(childUrl, state, errorMessage(error), 'INVALID_URL');
      }

      return crawlSitemapNode(normalizedChildUrl, depth + 1, state);
    });

    node.status = 'success';
    return node;
  } catch (error) {
    node.status = 'error';
    node.error = errorMessage(error);
    state.errors.push({ url, message: node.error });
    return node;
  }
}

function toUrlNode(entry: { loc: string; lastmod?: string; changefreq?: string; priority?: string }, state: CrawlState): UrlNode | null {
  if (state.urlCount >= state.limits.maxUrls) {
    state.errors.push({ url: entry.loc, message: 'Maximum URL count exceeded.', code: 'LIMIT_URLS' });
    return null;
  }

  state.urlCount += 1;
  return {
    type: 'url',
    url: entry.loc,
    lastmod: entry.lastmod,
    changefreq: entry.changefreq,
    priority: entry.priority,
  };
}

function markSkipped(node: SitemapNode, state: CrawlState, message: string, code: string): SitemapNode {
  node.status = 'skipped';
  node.error = message;
  state.errors.push({ url: node.url, message, code });
  return node;
}

function errorNode(url: string, state: CrawlState, message: string, code: string): SitemapNode {
  state.errors.push({ url, message, code });
  return {
    type: 'sitemap',
    url,
    status: 'error',
    children: [],
    error: message,
  };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function createRateLimitedFetcher(fetcher: FetchSitemap, maxRequestsPerSecond: number): FetchSitemap {
  const maxTokens = Math.max(1, maxRequestsPerSecond);
  const refillMs = 1_000;
  let tokens = maxTokens;
  let lastRefill = Date.now();
  let queue = Promise.resolve();

  return async (url) => {
    queue = queue.then(async () => {
      await waitForToken();
    });

    await queue;
    return fetcher(url);
  };

  async function waitForToken(): Promise<void> {
    refillTokens();

    while (tokens <= 0) {
      await delay(Math.max(0, refillMs - (Date.now() - lastRefill)));
      refillTokens();
    }

    tokens -= 1;
  }

  function refillTokens() {
    const now = Date.now();
    const windowsElapsed = Math.floor((now - lastRefill) / refillMs);
    if (windowsElapsed <= 0) {
      return;
    }

    tokens = Math.min(maxTokens, tokens + windowsElapsed * maxTokens);
    lastRefill += windowsElapsed * refillMs;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error.';
}

export function countChildUrls(node: TreeNode): number {
  if (node.type === 'url') {
    return 1;
  }

  return node.children.reduce((total, child) => total + countChildUrls(child), 0);
}
