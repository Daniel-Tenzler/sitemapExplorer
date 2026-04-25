export function normalizeSitemapUrl(value: string, baseUrl?: string): string {
  const url = baseUrl ? new URL(value, baseUrl) : new URL(value);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https sitemap URLs are supported.');
  }

  url.hash = '';
  return url.toString();
}

export function normalizeInitialSitemapUrl(value: string): string {
  const url = new URL(normalizeSitemapUrl(value));

  if (isBareDomainUrl(url)) {
    url.pathname = '/sitemap.xml';
  }

  return url.toString();
}

function isBareDomainUrl(url: URL): boolean {
  return url.hostname.includes('.') && url.pathname === '/' && url.search === '';
}
