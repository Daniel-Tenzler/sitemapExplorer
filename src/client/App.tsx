import { useState } from 'react';

import type { CrawlResult } from '../shared/types.js';
import { CrawlSummary } from './components/CrawlSummary.js';
import { CrawlLoadingState } from './components/CrawlLoadingState.js';
import { SitemapForm } from './components/SitemapForm.js';
import { SitemapTree } from './components/SitemapTree.js';

export default function App() {
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleCrawl(url: string) {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/sitemap/crawl', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = (await response.json()) as CrawlResult | { error?: string };

      if (!response.ok) {
        throw new Error('error' in body && body.error ? body.error : 'Unable to crawl sitemap.');
      }

      setResult(body as CrawlResult);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to crawl sitemap.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="page-title">
        <div className="hero-copy">
          <h1 id="page-title">Sitemap Explorer</h1>
          <p className="hero-text">
            Enter a sitemap URL to crawl nested indexes and list every URL.
          </p>
        </div>
        <SitemapForm onSubmit={handleCrawl} isLoading={isLoading} />
      </section>

      {error ? <div className="app-error" role="alert">{error}</div> : null}
      {isLoading ? <CrawlLoadingState /> : null}

      {result ? (
        <section className="results-grid" aria-label="Crawl results">
          <CrawlSummary summary={result.summary} />
          <SitemapTree root={result.root} />
        </section>
      ) : null}
    </main>
  );
}
