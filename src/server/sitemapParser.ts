import { XMLParser } from 'fast-xml-parser';

export type ParsedSitemap =
  | {
      kind: 'sitemapindex';
      sitemaps: Array<{ loc: string; lastmod?: string }>;
    }
  | {
      kind: 'urlset';
      urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }>;
    };

const parser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
  removeNSPrefix: true,
  trimValues: true,
});

export function parseSitemapXml(xml: string, sourceUrl: string): ParsedSitemap {
  let parsed: unknown;

  try {
    parsed = parser.parse(xml);
  } catch (error) {
    throw new Error(`Invalid XML: ${error instanceof Error ? error.message : 'Unable to parse document.'}`, { cause: error });
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid XML: document did not contain an object root.');
  }

  if ('sitemapindex' in parsed) {
    const root = parsed.sitemapindex;
    if (!isRecord(root)) {
      throw new Error('Invalid sitemap index format.');
    }

    return {
      kind: 'sitemapindex',
      sitemaps: asArray(root.sitemap)
        .map((entry) => readLocEntry(entry, sourceUrl))
        .filter((entry) => entry.loc.length > 0),
    };
  }

  if ('urlset' in parsed) {
    const root = parsed.urlset;
    if (!isRecord(root)) {
      throw new Error('Invalid URL set format.');
    }

    return {
      kind: 'urlset',
      urls: asArray(root.url)
        .map((entry) => readLocEntry(entry, sourceUrl))
        .filter((entry) => entry.loc.length > 0),
    };
  }

  throw new Error('XML is neither a sitemapindex nor a urlset.');
}

function readLocEntry(entry: unknown, sourceUrl: string) {
  if (!isRecord(entry)) {
    return { loc: '' };
  }

  const rawLoc = asText(entry.loc);
  if (!rawLoc) {
    return { loc: '' };
  }

  const loc = new URL(rawLoc, sourceUrl).toString();

  return {
    loc,
    lastmod: asText(entry.lastmod),
    changefreq: asText(entry.changefreq),
    priority: asText(entry.priority),
  };
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined ? [] : [value];
}

function asText(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
