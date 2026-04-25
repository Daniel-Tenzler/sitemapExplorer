# Sitemap Explorer Implementation Plan

## Goal

Build a standalone local web tool that accepts a sitemap URL, recursively crawls sitemap indexes and nested sitemaps, and presents the complete sitemap structure in an interactive tree view.

The first version should be optimized for correctness, clear error handling, and safe crawling limits rather than broad deployment complexity.

## Recommended Approach

Use a React/Vite frontend with a small Node backend.

This avoids browser CORS limitations because the backend performs all remote sitemap requests. The frontend only talks to the local backend API.

## High-Level Architecture

```text
User Browser
  |
  | enters sitemap URL
  v
React/Vite UI
  |
  | GET/POST crawl request
  v
Node API Server
  |
  | fetch sitemap XML or XML.GZ
  v
Remote Sitemap URLs
```

## Main Components

### Frontend

- Vite React TypeScript application.
- Input form for sitemap URL.
- Tree view for sitemap indexes, nested sitemaps, and page URLs.
- Loading, empty, success, and error states.
- Summary counts for discovered sitemaps, URLs, errors, and crawl duration.
- Expand/collapse controls for large trees.

### Backend

- Node HTTP API using Express or Fastify.
- Endpoint to start a sitemap crawl.
- URL validation and normalization.
- Sitemap fetching with timeout handling.
- Gzip decompression for `.xml.gz` sitemap files and gzip responses.
- XML parsing for sitemap indexes and URL sets.
- Recursive crawling of child sitemap URLs.
- Cycle detection and deduplication.
- Crawl limits for safety.

### Shared Types

- TypeScript interfaces for crawl results, tree nodes, errors, and summary metadata.
- Shared types can live in a common `src/shared` area if frontend and backend are in one workspace.

## Proposed Project Structure

```text
sitemapExplorer/
  package.json
  tsconfig.json
  vite.config.ts
  src/
    client/
      main.tsx
      App.tsx
      components/
        SitemapForm.tsx
        SitemapTree.tsx
        SitemapTreeNode.tsx
        CrawlSummary.tsx
      styles/
        app.css
    server/
      index.ts
      sitemapCrawler.ts
      sitemapParser.ts
      fetchSitemap.ts
      limits.ts
    shared/
      types.ts
```

Alternative structure if cleaner separation is desired later:

```text
apps/
  web/
  api/
packages/
  shared/
```

For the initial version, the single-app structure is simpler and preferable.

## Sitemap Handling Requirements

The crawler should support both official sitemap XML formats.

### Sitemap Index

```xml
<sitemapindex>
  <sitemap>
    <loc>https://example.com/sitemap-pages.xml</loc>
  </sitemap>
</sitemapindex>
```

Behavior:

- Treat each `<loc>` as a child sitemap.
- Fetch each child sitemap recursively.
- Preserve parent-child relationships in the returned tree.

### URL Set

```xml
<urlset>
  <url>
    <loc>https://example.com/page</loc>
    <lastmod>2026-04-24</lastmod>
  </url>
</urlset>
```

Behavior:

- Treat each `<url>` as a page URL leaf node.
- Capture optional metadata when available, such as `lastmod`, `changefreq`, and `priority`.

## API Design

### Crawl Sitemap

`POST /api/sitemap/crawl`

Request body:

```json
{
  "url": "https://example.com/sitemap.xml",
  "options": {
    "maxDepth": 10,
    "maxSitemaps": 500,
    "maxUrls": 50000
  }
}
```

Response body:

```json
{
  "root": {
    "type": "sitemap",
    "url": "https://example.com/sitemap.xml",
    "status": "success",
    "children": [
      {
        "type": "sitemap",
        "url": "https://example.com/sitemap-pages.xml",
        "status": "success",
        "children": [
          {
            "type": "url",
            "url": "https://example.com/page",
            "lastmod": "2026-04-24"
          }
        ]
      }
    ]
  },
  "summary": {
    "sitemapsDiscovered": 2,
    "urlsDiscovered": 1,
    "errors": 0,
    "durationMs": 120
  },
  "errors": []
}
```

## Data Model

### Tree Node Types

```ts
type SitemapNode = {
  type: 'sitemap';
  url: string;
  status: 'pending' | 'success' | 'error' | 'skipped';
  children: TreeNode[];
  error?: string;
};

type UrlNode = {
  type: 'url';
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
};

type TreeNode = SitemapNode | UrlNode;
```

### Crawl Error

```ts
type CrawlError = {
  url: string;
  message: string;
  code?: string;
};
```

## Crawler Behavior

1. Validate the submitted sitemap URL.
2. Normalize the URL to avoid duplicate crawls caused by minor formatting differences.
3. Fetch the sitemap with a request timeout.
4. Decompress gzip content if needed.
5. Parse XML safely.
6. Detect whether the root document is a `sitemapindex` or `urlset`.
7. For sitemap indexes, recursively crawl each child sitemap URL.
8. For URL sets, collect all page URLs as leaf nodes.
9. Track visited sitemap URLs to prevent cycles.
10. Stop crawling when configured limits are reached.
11. Return partial results with errors instead of failing the whole crawl when one nested sitemap fails.

## Safety Limits

Initial default limits:

- `maxDepth`: `15`
- `maxSitemaps`: `500`
- `maxUrls`: `50000`
- `requestTimeoutMs`: `15000`
- `maxResponseBytes`: `50 MB`
- `concurrency`: `5`
- `maxRequestsPerSecond`: `3`

These limits should be configurable from backend constants first. UI controls can be added later if needed.

## Error Handling

The backend should return structured errors for:

- Invalid URL.
- Unsupported protocol.
- Fetch timeout.
- Non-2xx HTTP response.
- Response too large.
- Invalid XML.
- XML that is neither `sitemapindex` nor `urlset`.
- Crawl limit exceeded.
- Duplicate or cyclic sitemap reference.

Nested sitemap failures should mark that branch as errored while preserving the rest of the crawl result.

## UI Behavior

### Form

- Single URL input.
- Submit button.
- Basic client-side URL validation.
- Disable submit while crawling.

### Summary

Show after crawl completion:

- Root sitemap URL.
- Number of sitemap files discovered.
- Number of page URLs discovered.
- Number of errors.
- Crawl duration.

### Tree View

- Sitemap nodes are expandable.
- URL nodes are leaves.
- Show counts next to sitemap nodes when available.
- Show error badges for failed sitemap nodes.
- Allow copying URLs.
- Link URLs so they can be opened in a new tab.

### Large Result Handling

The first version can render a normal recursive tree. If large sitemaps cause performance issues, add virtualization later.

## Implementation Phases

### Phase 1: Project Setup

- Initialize Vite React TypeScript project.
- Add Node backend entry point.
- Add development scripts for frontend and backend.
- Configure TypeScript, linting, and formatting.

Expected scripts:

```json
{
  "dev": "concurrently run frontend and backend dev servers",
  "build": "build frontend and backend",
  "lint": "run eslint",
  "typecheck": "run tsc without emit",
  "test": "run test suite"
}
```

### Phase 2: Backend Crawler

- Implement URL validation.
- Implement sitemap fetching.
- Add gzip support.
- Add XML parser.
- Implement recursive sitemap crawling.
- Add deduplication and cycle detection.
- Add safety limits.
- Return structured tree response.

### Phase 3: Frontend UI

- Build URL input form.
- Call backend crawl endpoint.
- Render summary results.
- Render recursive tree view.
- Add loading and error states.
- Add basic responsive styling.

### Phase 4: Tests

- Unit test XML parsing for sitemap indexes.
- Unit test XML parsing for URL sets.
- Unit test invalid XML handling.
- Unit test recursive crawling with mocked fetch responses.
- Unit test cycle detection.
- Unit test crawl limits.
- Component test basic tree rendering if test setup supports it.

### Phase 5: Validation

- Run linting.
- Run TypeScript checks.
- Run tests.
- Run production build.
- Manually test with a small public sitemap.
- Manually test with a sitemap index containing nested sitemaps.

## Suggested Dependencies

Use dependencies conservatively.

Likely useful:

- `@vitejs/plugin-react` for React/Vite.
- `express` or `fastify` for the backend API.
- `fast-xml-parser` for XML parsing.
- `p-limit` for concurrency control, unless a small internal queue is preferred.
- `concurrently` for local development scripts.
- `vitest` for tests.

Prefer native `fetch`, `URL`, `AbortController`, and Node `zlib` APIs where possible.

## Important Edge Cases

- Sitemap URL returns gzip content without a `.gz` extension.
- Sitemap URL has a `.gz` extension but missing gzip header.
- Sitemap index references relative URLs.
- Sitemap index references the same child sitemap more than once.
- Sitemap index creates a cycle.
- Sitemap contains XML namespaces.
- Sitemap contains malformed XML.
- Sitemap contains more URLs than the configured limit.
- Remote server is slow or unavailable.
- Remote server returns HTML instead of XML.

## Non-Goals For Initial Version

- Hosted multi-user deployment.
- Authentication.
- Persistent crawl history.
- Scheduled crawling.
- Export formats such as CSV or JSON.
- Full SEO auditing.
- Chrome extension integration.
- Rendering every very large result with virtualization.

## Future Enhancements

- Export results to JSON or CSV.
- Search and filter within the tree.
- Show duplicate page URLs.
- Show status codes for page URLs by optionally checking each URL.
- Add robots.txt discovery for sitemap links.
- Add automatic `/sitemap.xml` suggestion from a domain.
- Add virtualized tree rendering for very large sitemap sets.
- Add hosted deployment mode with stricter SSRF protections.

## Validation Checklist

Before considering the implementation complete:

- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm test` passes.
- `npm run build` passes.
- A simple `urlset` sitemap renders correctly.
- A nested `sitemapindex` renders correctly.
- A failed nested sitemap is shown as an error branch without breaking the whole tree.
- Crawl limits prevent runaway recursion or extremely large responses.
