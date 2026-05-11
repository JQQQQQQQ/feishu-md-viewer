import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeReact from 'rehype-react';
import * as prod from 'react/jsx-runtime';
import { feishuComponents } from '../viewer/components/Markdown/FeishuComponents';
import type { ReactElement } from 'react';

const production = { Fragment: prod.Fragment, jsx: prod.jsx, jsxs: prod.jsxs };

interface HastNode {
  type: string;
  children?: HastNode[];
  [key: string]: unknown;
}

interface HastElement extends HastNode {
  type: 'element';
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
}

interface HastRoot extends HastNode {
  type: 'root';
  children: HastNode[];
}

function isElement(node: HastNode): node is HastElement {
  return node.type === 'element' && typeof node.tagName === 'string';
}

function getHeadingLevel(node: HastNode): number | null {
  if (!isElement(node)) return null;
  const match = /^h([1-6])$/.exec(node.tagName);
  return match?.[1] ? Number(match[1]) : null;
}

function makeSection(level: number, children: HastNode[]): HastElement {
  return {
    type: 'element',
    tagName: 'section',
    properties: {
      className: ['feishu-section', `feishu-section--level-${level}`],
      dataHeadingLevel: String(level),
    },
    children,
  };
}

function groupHeadingSections(nodes: HastNode[]): HastNode[] {
  const grouped: HastNode[] = [];
  let index = 0;

  while (index < nodes.length) {
    const node = nodes[index];
    if (!node) break;

    const level = getHeadingLevel(node);
    if (!level) {
      grouped.push(node);
      index += 1;
      continue;
    }

    const sectionChildren: HastNode[] = [];
    grouped.push(node);
    index += 1;

    while (index < nodes.length) {
      const next = nodes[index];
      if (!next) break;

      const nextLevel = getHeadingLevel(next);
      if (nextLevel && nextLevel <= level) break;

      sectionChildren.push(next);
      index += 1;
    }

    if (sectionChildren.length > 0) {
      grouped.push(makeSection(level, groupHeadingSections(sectionChildren)));
    }
  }

  return grouped;
}

function rehypeSectionHierarchy() {
  return (tree: HastRoot) => {
    tree.children = groupHeadingSections(tree.children);
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeSectionHierarchy)
  .use(rehypeReact, {
    ...production,
    components: feishuComponents,
  });

export function parseMarkdown(content: string): ReactElement {
  const file = processor.processSync(content);
  return file.result as ReactElement;
}

export function extractMermaidBlocks(content: string): { code: string; index: number }[] {
  const blocks: { code: string; index: number }[] = [];
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(content)) !== null) {
    blocks.push({ code: match[1]?.trim() ?? '', index: idx });
    idx++;
  }

  return blocks;
}
