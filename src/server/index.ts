import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';

import type { CrawlOptions } from '../shared/types.js';
import { isAllowedSitemapHost, readCsvEnv, readPositiveIntegerEnv } from './accessControl.js';
import { MAX_CRAWL_LIMITS } from './limits.js';
import { crawlSitemap } from './sitemapCrawler.js';

const app = express();
const port = Number(process.env.PORT ?? 4174);
const dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(dirname, '../../client');
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedSitemapHosts = readCsvEnv('ALLOWED_SITEMAP_HOSTS');
const rateLimitWindowMs = readPositiveIntegerEnv('RATE_LIMIT_WINDOW_MS', 60_000, 3_600_000);
const maxRequestsPerWindow = readPositiveIntegerEnv('MAX_CRAWL_REQUESTS_PER_WINDOW', 20, 1_000);
const maxGlobalRequestsPerWindow = readPositiveIntegerEnv('MAX_GLOBAL_CRAWL_REQUESTS_PER_WINDOW', 60, 5_000);
const maxActiveCrawls = readPositiveIntegerEnv('MAX_ACTIVE_CRAWLS', 3, MAX_CRAWL_LIMITS.maxSitemaps);
const maxActiveCrawlsPerIp = readPositiveIntegerEnv('MAX_ACTIVE_CRAWLS_PER_IP', 1, maxActiveCrawls);
const crawlRequestsByIp = new Map<string, { count: number; resetAt: number }>();
const globalCrawlRequests = { count: 0, resetAt: 0 };
const activeCrawlsByIp = new Map<string, number>();
let activeCrawls = 0;

app.set('trust proxy', 'loopback');

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.post('/api/sitemap/crawl', async (request, response) => {
  const body = request.body as { url?: unknown; options?: unknown };
  const clientIp = request.ip ?? 'unknown';

  if (!allowRequest(clientIp)) {
    response.status(429).json({ error: 'Too many crawl requests. Try again later.' });
    return;
  }

  if (activeCrawls >= maxActiveCrawls || (activeCrawlsByIp.get(clientIp) ?? 0) >= maxActiveCrawlsPerIp) {
    response.status(503).json({ error: 'Crawler is busy. Try again shortly.' });
    return;
  }

  if (typeof body.url !== 'string' || body.url.trim().length === 0) {
    response.status(400).json({ error: 'A sitemap URL is required.' });
    return;
  }

  if (!isAllowedSitemapHost(body.url, allowedSitemapHosts)) {
    response.status(403).json({ error: 'Sitemap host is not allowed.' });
    return;
  }

  activeCrawls += 1;
  activeCrawlsByIp.set(clientIp, (activeCrawlsByIp.get(clientIp) ?? 0) + 1);
  try {
    const result = await crawlSitemap(body.url, readOptions(body.options));
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to crawl sitemap.' });
  } finally {
    activeCrawls -= 1;
    releaseActiveCrawl(clientIp);
  }
});

app.use(express.static(clientDist));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Sitemap Explorer API listening at http://127.0.0.1:${port}`);
});

function readOptions(value: unknown): CrawlOptions {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    maxDepth: readClampedPositiveInteger(record.maxDepth, MAX_CRAWL_LIMITS.maxDepth),
    maxSitemaps: readClampedPositiveInteger(record.maxSitemaps, MAX_CRAWL_LIMITS.maxSitemaps),
    maxUrls: readClampedPositiveInteger(record.maxUrls, MAX_CRAWL_LIMITS.maxUrls),
    maxCrawlDurationMs: readClampedPositiveInteger(record.maxCrawlDurationMs, MAX_CRAWL_LIMITS.maxCrawlDurationMs),
    maxRequestsPerSecond: readClampedPositiveInteger(record.maxRequestsPerSecond, MAX_CRAWL_LIMITS.maxRequestsPerSecond),
    maxTotalResponseBytes: readClampedPositiveInteger(record.maxTotalResponseBytes, MAX_CRAWL_LIMITS.maxTotalResponseBytes),
  };
}

function readClampedPositiveInteger(value: unknown, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }

  return Math.min(value, max);
}

function allowRequest(key: string): boolean {
  const now = Date.now();
  const entry = crawlRequestsByIp.get(key);

  if (!entry || entry.resetAt <= now) {
    if (!allowGlobalRequest(now)) {
      return false;
    }

    crawlRequestsByIp.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    cleanupExpiredRateLimits(now);
    return true;
  }

  if (entry.count >= maxRequestsPerWindow) {
    return false;
  }

  if (!allowGlobalRequest(now)) {
    return false;
  }

  entry.count += 1;
  return true;
}

function allowGlobalRequest(now: number): boolean {
  if (globalCrawlRequests.resetAt <= now) {
    globalCrawlRequests.count = 1;
    globalCrawlRequests.resetAt = now + rateLimitWindowMs;
    return true;
  }

  if (globalCrawlRequests.count >= maxGlobalRequestsPerWindow) {
    return false;
  }

  globalCrawlRequests.count += 1;
  return true;
}

function cleanupExpiredRateLimits(now: number): void {
  for (const [ip, entry] of crawlRequestsByIp) {
    if (entry.resetAt <= now) {
      crawlRequestsByIp.delete(ip);
    }
  }
}

function releaseActiveCrawl(ip: string): void {
  const count = activeCrawlsByIp.get(ip) ?? 0;

  if (count <= 1) {
    activeCrawlsByIp.delete(ip);
    return;
  }

  activeCrawlsByIp.set(ip, count - 1);
}
