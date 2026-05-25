import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';

import { DEFAULT_CRAWL_LIMITS } from './limits.js';

export type FetchSitemap = (url: string, signal?: AbortSignal) => Promise<string>;

type PinnedUrl = {
  url: URL;
  address: string;
};

type PinnedResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: http.IncomingMessage;
};

const maxRedirects = 5;

export async function fetchSitemap(url: string, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_CRAWL_LIMITS.requestTimeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });

  try {
    const response = await fetchWithSafeRedirects(url, controller.signal);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Remote server returned HTTP ${response.status}.`);
    }

    const bytes = await readLimitedBody(response.body, DEFAULT_CRAWL_LIMITS.maxResponseBytes);
    const contentType = headerValue(response.headers['content-type']);
    const shouldTryGunzip = url.toLowerCase().endsWith('.gz') || contentType.includes('gzip') || hasGzipMagic(bytes);
    const body = shouldTryGunzip && hasGzipMagic(bytes) ? await gunzipLimited(bytes, DEFAULT_CRAWL_LIMITS.maxResponseBytes) : bytes;

    return new TextDecoder('utf-8').decode(body);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Fetch timeout.', { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

async function fetchWithSafeRedirects(url: string, signal: AbortSignal): Promise<PinnedResponse> {
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const pinnedUrl = await resolveSafeHttpUrl(currentUrl);

    const response = await getPinned(pinnedUrl, signal);

    if (!isRedirect(response.status)) {
      return response;
    }

    const location = headerValue(response.headers.location);
    if (!location) {
      throw new Error('Remote server returned a redirect without a location.');
    }

    response.body.resume();
    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error('Too many redirects.');
}

async function resolveSafeHttpUrl(value: string): Promise<PinnedUrl> {
  const url = new URL(value);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https sitemap URLs are supported.');
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error('Sitemap URL resolves to a private or reserved network address.');
  }

  return { url, address: addresses[0].address };
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function getPinned({ url, address }: PinnedUrl, signal: AbortSignal): Promise<PinnedResponse> {
  const client = url.protocol === 'https:' ? https : http;
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;

  return new Promise((resolve, reject) => {
    const request = client.request(
      {
        protocol: url.protocol,
        hostname: address,
        port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          accept: 'application/xml,text/xml,*/*',
          host: url.host,
        },
        servername: url.hostname,
        signal,
      },
      (response) => {
        resolve({ status: response.statusCode ?? 0, headers: response.headers, body: response });
      },
    );

    request.on('error', reject);
    request.end();
  });
}

async function readLimitedBody(stream: AsyncIterable<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;

  for await (const value of stream) {
    total += value.byteLength;
    if (total > maxBytes) {
      throw new Error('Response too large.');
    }

    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}

export async function gunzipLimited(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  return readLimitedBody(Readable.from(bytes).pipe(createGunzip()), maxBytes);
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join(',') : value ?? '';
}

function hasGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export function isBlockedAddress(address: string): boolean {
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) {
    return isBlockedIpv4(address);
  }

  if (ipVersion === 6) {
    return isBlockedIpv6(address);
  }

  return true;
}

function isBlockedIpv4(address: string): boolean {
  const [first = 0, second = 0, third = 0, fourth = 0] = address.split('.').map(Number);

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    (first === 255 && second === 255 && third === 255 && fourth === 255) ||
    first >= 224
  );
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized.startsWith('::ffff:')) {
    return isBlockedAddress(normalized.slice('::ffff:'.length));
  }

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('64:ff9b:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:2:') ||
    normalized.startsWith('2001:db8:') ||
    normalized.startsWith('2002:')
  );
}
