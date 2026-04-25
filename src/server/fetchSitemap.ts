import { gunzipSync } from 'node:zlib';

import { DEFAULT_CRAWL_LIMITS } from './limits.js';

export type FetchSitemap = (url: string) => Promise<string>;

export async function fetchSitemap(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_CRAWL_LIMITS.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/xml,text/xml,*/*' },
      signal: controller.signal,
    });

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
