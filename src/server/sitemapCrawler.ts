import type { CrawlError, CrawlOptions, CrawlResult, SitemapNode, TreeNode, UrlNode } from '../shared/types.js';

import { DEFAULT_CRAWL_LIMITS } from './limits.js';
import { fetchSitemap, type FetchSitemap } from './fetchSitemap.js';
import { parseSitemapXml } from './sitemapParser.js';
import { normalizeInitialSitemapUrl, normalizeSitemapUrl } from './urlUtils.js';

type CrawlDeps = {
  fetcher?: FetchSitemap;
  fetchCache?: SitemapFetchCache;
};

type SitemapFetchCache = Map<string, string>;

const FETCH_CACHE_MAX_ENTRIES = 500;
const FETCH_CACHE_MAX_BYTES = DEFAULT_CRAWL_LIMITS.maxTotalResponseBytes;
const defaultFetchCache: SitemapFetchCache = new Map();

type CrawlState = {
  visitedSitemaps: Set<string>;
  sitemapCount: number;
  urlCount: number;
  responseBytes: number;
  errors: CrawlError[];
  limits: typeof DEFAULT_CRAWL_LIMITS;
  fetcher: FetchSitemap;
  signal: AbortSignal;
};

export async function crawlSitemap(url: string, options: CrawlOptions = {}, deps: CrawlDeps = {}): Promise<CrawlResult> {
  const startedAt = Date.now();
  const rootUrl = normalizeInitialSitemapUrl(url);
  const limits = { ...DEFAULT_CRAWL_LIMITS, ...options };
  const baseFetcher = deps.fetcher ?? fetchSitemap;
  const cache = deps.fetchCache ?? (deps.fetcher ? undefined : defaultFetchCache);
  const rateLimitedFetcher = createRateLimitedFetcher(baseFetcher, limits.maxRequestsPerSecond);
  const controller = new AbortController();
  const crawlTimeout = setTimeout(() => controller.abort(), limits.maxCrawlDurationMs);
  const state: CrawlState = {
    visitedSitemaps: new Set(),
    sitemapCount: 0,
    urlCount: 0,
    responseBytes: 0,
    errors: [],
    limits,
    fetcher: cache ? createCachedFetcher(rateLimitedFetcher, cache) : rateLimitedFetcher,
    signal: controller.signal,
  };

  try {
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
  } finally {
    clearTimeout(crawlTimeout);
  }
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
    assertCrawlActive(state.signal);
    const xml = await state.fetcher(url, state.signal);
    assertCrawlActive(state.signal);
    trackResponseBytes(xml, state);
    const parsed = parseSitemapXml(xml, url, DEFAULT_CRAWL_LIMITS);

    if (parsed.kind === 'urlset') {
      node.children = parsed.urls.map((entry) => toUrlNode(entry, state)).filter((child): child is UrlNode => child !== null);
      node.status = 'success';
      return node;
    }

    const childUrls = parsed.sitemaps.map((entry) => entry.loc);
    node.children = await mapWithConcurrency(childUrls, state.limits.concurrency, async (childUrl) => {
      if (state.sitemapCount >= state.limits.maxSitemaps) {
        return markSkippedUrl(childUrl, state, 'Maximum sitemap count exceeded.', 'LIMIT_SITEMAPS');
      }

      if (state.urlCount >= state.limits.maxUrls) {
        return markSkippedUrl(childUrl, state, 'Maximum URL count exceeded.', 'LIMIT_URLS');
      }

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

function markSkippedUrl(url: string, state: CrawlState, message: string, code: string): SitemapNode {
  state.errors.push({ url, message, code });
  return {
    type: 'sitemap',
    url,
    status: 'skipped',
    children: [],
    error: message,
  };
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

  return async (url, signal) => {
    queue = queue.then(async () => {
      if (signal) {
        assertCrawlActive(signal);
      }
      await waitForToken(signal);
    });

    await queue;
    if (signal) {
      assertCrawlActive(signal);
    }
    return fetcher(url, signal);
  };

  async function waitForToken(signal?: AbortSignal): Promise<void> {
    refillTokens();

    while (tokens <= 0) {
      await delay(Math.max(0, refillMs - (Date.now() - lastRefill)));
      if (signal) {
        assertCrawlActive(signal);
      }
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

function createCachedFetcher(fetcher: FetchSitemap, cache: SitemapFetchCache): FetchSitemap {
  return async (url, signal) => {
    const cached = cache.get(url);
    if (cached !== undefined) {
      return cached;
    }

    // Cache completed responses only, so one crawl's abort cannot cancel another crawl's request.
    const xml = await fetcher(url, signal);
    if (!signal?.aborted && xml.length * 2 <= FETCH_CACHE_MAX_BYTES) {
      cache.set(url, xml);
      evictOldestCacheEntries(cache);
    }
    return xml;
  };
}

function evictOldestCacheEntries(cache: SitemapFetchCache): void {
  // Budget two bytes per UTF-16 code unit to bound retained response text.
  let bytes = 0;
  for (const xml of cache.values()) {
    bytes += xml.length * 2;
  }

  for (const [url, xml] of cache) {
    if (cache.size <= FETCH_CACHE_MAX_ENTRIES && bytes <= FETCH_CACHE_MAX_BYTES) {
      break;
    }
    bytes -= xml.length * 2;
    cache.delete(url);
  }
}

function trackResponseBytes(xml: string, state: CrawlState): void {
  state.responseBytes += new TextEncoder().encode(xml).byteLength;

  if (state.responseBytes > state.limits.maxTotalResponseBytes) {
    throw new Error('Crawl response budget exceeded.');
  }
}

function assertCrawlActive(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new Error('Crawl timeout.');
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
