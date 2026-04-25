import { type CSSProperties, useState } from 'react';

import type { SitemapNode, TreeNode } from '../../shared/types.js';

type SitemapTreeNodeProps = {
  node: TreeNode;
  level: number;
  defaultOpen?: boolean;
};

export function SitemapTreeNode({ node, level, defaultOpen = false }: SitemapTreeNodeProps) {
  if (node.type === 'url') {
    return (
      <div className="tree-node url-node" style={levelStyle(level)}>
        <span className="node-glyph">URL</span>
        <SelectableUrl value={node.url} />
        {node.lastmod ? <span className="node-meta">Last modified {node.lastmod}</span> : null}
        {node.changefreq ? <span className="node-meta">{node.changefreq}</span> : null}
        {node.priority ? <span className="node-meta">Priority {node.priority}</span> : null}
        <OpenLink value={node.url} />
        <CopyButton value={node.url} />
      </div>
    );
  }

  return <SitemapBranch node={node} level={level} defaultOpen={defaultOpen} />;
}

function SitemapBranch({ node, level, defaultOpen }: { node: SitemapNode; level: number; defaultOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const urlCount = countUrls(node);

  return (
    <div className="branch">
      <div className={`tree-node sitemap-node status-${node.status}`} style={levelStyle(level)}>
        <button className="toggle-button" type="button" onClick={() => setIsOpen((value) => !value)}>
          {isOpen ? '−' : '+'}
        </button>
        <span className="node-glyph">XML</span>
        <SelectableUrl value={node.url} />
        <span className="node-count">{node.children.length.toLocaleString()} children</span>
        <span className="node-count">{urlCount.toLocaleString()} URLs</span>
        {node.status !== 'success' ? <span className="status-badge">{node.status}</span> : null}
        <OpenLink value={node.url} />
        <CopyButton value={node.url} />
      </div>
      {node.error ? <p className="node-error" style={levelStyle(level + 1)}>{node.error}</p> : null}
      {isOpen ? (
        <div className="branch-children">
          {node.children.map((child) => (
            <SitemapTreeNode key={`${child.type}:${child.url}`} node={child} level={level + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SelectableUrl({ value }: { value: string }) {
  const parts = parseUrlParts(value);

  if (parts) {
    return (
      <span className="selectable-url" title={value}>
        <span className="url-origin">{parts.origin}</span>
        <span className="url-path">{parts.path}</span>
      </span>
    );
  }

  return <span className="selectable-url">{value}</span>;
}

function OpenLink({ value }: { value: string }) {
  return (
    <a className="open-link" href={value} target="_blank" rel="noreferrer">
      Open
    </a>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button className="copy-button" type="button" onClick={handleCopy}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function countUrls(node: TreeNode): number {
  if (node.type === 'url') {
    return 1;
  }

  return node.children.reduce((total, child) => total + countUrls(child), 0);
}

function levelStyle(level: number): CSSProperties {
  return { '--level': level } as CSSProperties;
}

function parseUrlParts(value: string): { origin: string; path: string } | null {
  try {
    const url = new URL(value);
    return {
      origin: url.origin,
      path: `${url.pathname}${url.search}${url.hash}`,
    };
  } catch {
    return null;
  }
}
