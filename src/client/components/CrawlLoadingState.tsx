import { useEffect, useState } from 'react';

const STATUS_MESSAGES = [
  'Opening the root sitemap',
  'Reading sitemap XML',
  'Following nested sitemap indexes',
  'Respecting the 3 requests/sec crawl limit',
  'Deduplicating repeated sitemap references',
  'Collecting URL leaves and metadata',
  'Preserving partial results from slow branches',
];

export function CrawlLoadingState() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);

    return () => window.clearInterval(intervalId);
  }, []);

  const message = STATUS_MESSAGES[Math.floor(elapsedSeconds / 2) % STATUS_MESSAGES.length];

  return (
    <section className="loading-card" aria-live="polite" aria-label="Crawl progress">
      <div className="loading-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="loading-copy">
        <p className="eyebrow">Crawl in progress</p>
        <h2>Crawling sitemap network</h2>
        <p>{message}</p>
      </div>
      <div className="loading-meter" aria-hidden="true">
        <span />
      </div>
      <div className="loading-facts">
        <span>{elapsedSeconds}s elapsed</span>
        <span>Depth limit 15</span>
        <span>3 req/s</span>
      </div>
    </section>
  );
}
