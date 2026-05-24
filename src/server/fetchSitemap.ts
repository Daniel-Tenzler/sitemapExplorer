import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { gunzipSync } from 'node:zlib';

import { DEFAULT_CRAWL_LIMITS } from './limits.js';

export type FetchSitemap = (url: string) => Promise<string>;

const maxRedirects = 5;

export async function fetchSitemap(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_CRAWL_LIMITS.requestTimeoutMs);

  try {
    const response = await fetchWithSafeRedirects(url, controller.signal);

    if (!response.ok) {
      throw new Error(`Remote server returned HTTP ${response.status}.`);
    }

    if (!response.body) {
      throw new Error('Remote server returned an empty response.');
    }

    const bytes = await readLimitedBody(response.body, DEFAULT_CRAWL_LIMITS.maxResponseBytes);
    const contentType = response.headers.get('content-type') ?? '';
    const shouldTryGunzip = url.toLowerCase().endsWith('.gz') || contentType.includes('gzip') || hasGzipMagic(bytes);
    const body = shouldTryGunzip && hasGzipMagic(bytes) ? gunzipSync(bytes) : bytes;

    if (body.byteLength > DEFAULT_CRAWL_LIMITS.maxResponseBytes) {
      throw new Error('Response too large.');
    }

    return new TextDecoder('utf-8').decode(body);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Fetch timeout.', { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithSafeRedirects(url: string, signal: AbortSignal): Promise<Response> {
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertSafeHttpUrl(currentUrl);

    const response = await fetch(currentUrl, {
      headers: { accept: 'application/xml,text/xml,*/*' },
      redirect: 'manual',
      signal,
    });

    if (!isRedirect(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new Error('Remote server returned a redirect without a location.');
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error('Too many redirects.');
}

async function assertSafeHttpUrl(value: string): Promise<void> {
  const url = new URL(value);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https sitemap URLs are supported.');
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error('Sitemap URL resolves to a private or reserved network address.');
  }
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

async function readLimitedBody(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

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

function hasGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function isBlockedAddress(address: string): boolean {
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
  const [first = 0, second = 0] = address.split('.').map(Number);

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('ff') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}
