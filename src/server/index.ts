import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';

import type { CrawlOptions } from '../shared/types.js';
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
const rateLimitWindowMs = 60_000;
const maxRequestsPerWindow = 20;
const maxActiveCrawls = 3;
const crawlRequestsByIp = new Map<string, { count: number; resetAt: number }>();
let activeCrawls = 0;

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.post('/api/sitemap/crawl', async (request, response) => {
  const body = request.body as { url?: unknown; options?: unknown };

  if (!allowRequest(request.ip)) {
    response.status(429).json({ error: 'Too many crawl requests. Try again later.' });
    return;
  }

  if (activeCrawls >= maxActiveCrawls) {
    response.status(503).json({ error: 'Crawler is busy. Try again shortly.' });
    return;
  }

  if (typeof body.url !== 'string' || body.url.trim().length === 0) {
    response.status(400).json({ error: 'A sitemap URL is required.' });
    return;
  }

  activeCrawls += 1;
  try {
    const result = await crawlSitemap(body.url, readOptions(body.options));
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to crawl sitemap.' });
  } finally {
    activeCrawls -= 1;
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
    maxRequestsPerSecond: readClampedPositiveInteger(record.maxRequestsPerSecond, MAX_CRAWL_LIMITS.maxRequestsPerSecond),
  };
}

function readClampedPositiveInteger(value: unknown, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }

  return Math.min(value, max);
}

function allowRequest(ip: string | undefined): boolean {
  const key = ip ?? 'unknown';
  const now = Date.now();
  const entry = crawlRequestsByIp.get(key);

  if (!entry || entry.resetAt <= now) {
    crawlRequestsByIp.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    cleanupExpiredRateLimits(now);
    return true;
  }

  if (entry.count >= maxRequestsPerWindow) {
    return false;
  }

  entry.count += 1;
  return true;
}

function cleanupExpiredRateLimits(now: number): void {
  for (const [ip, entry] of crawlRequestsByIp) {
    if (entry.resetAt <= now) {
      crawlRequestsByIp.delete(ip);
    }
  }
}
