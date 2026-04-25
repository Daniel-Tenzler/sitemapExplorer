import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';

import { crawlSitemap } from './sitemapCrawler.js';

const app = express();
const port = Number(process.env.PORT ?? 4174);
const dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(dirname, '../../client');

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.post('/api/sitemap/crawl', async (request, response) => {
  const body = request.body as { url?: unknown; options?: unknown };

  if (typeof body.url !== 'string' || body.url.trim().length === 0) {
    response.status(400).json({ error: 'A sitemap URL is required.' });
    return;
  }

  try {
    const result = await crawlSitemap(body.url, isOptions(body.options) ? body.options : {});
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to crawl sitemap.' });
  }
});

app.use(express.static(clientDist));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Sitemap Explorer API listening at http://127.0.0.1:${port}`);
});

function isOptions(value: unknown): value is { maxDepth?: number; maxSitemaps?: number; maxUrls?: number; maxRequestsPerSecond?: number } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return ['maxDepth', 'maxSitemaps', 'maxUrls', 'maxRequestsPerSecond'].every((key) => {
    const maybeValue = (value as Record<string, unknown>)[key];
    return maybeValue === undefined || (typeof maybeValue === 'number' && Number.isInteger(maybeValue) && maybeValue > 0);
  });
}
