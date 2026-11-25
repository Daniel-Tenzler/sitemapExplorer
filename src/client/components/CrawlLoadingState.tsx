import { useEffect, useState } from 'react';

const STATUS_MESSAGES = [
  'Fetching root sitemap',
  'Parsing XML',
  'Following nested indexes',
  'Rate limited to 3 req/s',
  'Skipping duplicate sitemaps',
  'Collecting URLs',
  'Keeping results from failed branches',
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
        <h2>Crawling</h2>
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
