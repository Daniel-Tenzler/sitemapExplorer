import type { SitemapNode } from '../../shared/types.js';
import { SitemapTreeNode } from './SitemapTreeNode.js';

type SitemapTreeProps = {
  root: SitemapNode;
};

export function SitemapTree({ root }: SitemapTreeProps) {
  return (
    <section className="tree-card">
      <div className="tree-heading">
        <h2>Structure</h2>
      </div>
      <SitemapTreeNode node={root} level={0} defaultOpen />
    </section>
  );
}
