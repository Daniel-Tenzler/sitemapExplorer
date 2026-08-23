import type { CrawlSummary as CrawlSummaryData } from '../../shared/types.js';

type CrawlSummaryProps = {
  summary: CrawlSummaryData;
};

export function CrawlSummary({ summary }: CrawlSummaryProps) {
  const metrics = [
    ['Sitemaps', summary.sitemapsDiscovered.toLocaleString()],
    ['URLs', summary.urlsDiscovered.toLocaleString()],
    ['Errors', summary.errors.toLocaleString()],
    ['Duration', `${summary.durationMs.toLocaleString()} ms`],
  ];

  return (
    <aside className="summary-card">
      <h2>Summary</h2>
      <div className="summary-url">
        <span>Root</span>
        <a href={summary.rootUrl} target="_blank" rel="noreferrer">{summary.rootUrl}</a>
      </div>
      <dl className="metric-grid">
        {metrics.map(([label, value]) => (
          <div className="metric" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
