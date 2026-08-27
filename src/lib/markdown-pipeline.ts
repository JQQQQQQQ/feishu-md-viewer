import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeReact from 'rehype-react';
import * as prod from 'react/jsx-runtime';
import { feishuComponents } from '../viewer/components/Markdown/FeishuComponents';
import { resetMermaidRenderCounter } from '../viewer/components/Markdown/CodeBlock/CodeBlock';
import type { MarkdownSourceContext } from './markdown-resource-resolver';
import { resolveMarkdownSrcSet, resolveMarkdownUrl } from './markdown-resource-resolver';
import type { ReactElement } from 'react';

const production = { Fragment: prod.Fragment, jsx: prod.jsx, jsxs: prod.jsxs };

const markdownHtmlSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'video',
  ],
  attributes: {
    ...defaultSchema.attributes,
    // remark-gfm emits `checked` for completed task-list inputs.  The
    // GitHub-style default schema permits only the checkbox type/disabled
    // attributes, so preserve this harmless boolean explicitly.
    input: [...(defaultSchema.attributes?.input ?? []), 'checked'],
    details: [...(defaultSchema.attributes?.details ?? []), 'open'],
    source: [...(defaultSchema.attributes?.source ?? []), 'src', 'srcSet', 'sizes', 'media', 'type'],
    img: [...(defaultSchema.attributes?.img ?? []), 'srcSet', 'sizes', 'loading', 'decoding', 'width', 'height'],
    video: ['src', 'poster', 'preload', 'controls', 'playsInline', 'width', 'height'],
    a: [...(defaultSchema.attributes?.a ?? []), 'download', 'target', 'rel'],
    div: [...(defaultSchema.attributes?.div ?? []), 'align'],
  },
};

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

function hashStableTableIdentity(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
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

function rehypeNormalizeTaskCheckboxes() {
  const visit = (node: HastNode): void => {
    if (isElement(node)
      && node.tagName === 'input'
      && node.properties?.type === 'checkbox'
      && node.properties.disabled === true
      && !Object.hasOwn(node.properties, 'checked')) {
      node.properties.checked = false;
    }

    node.children?.forEach(visit);
  };

  return (tree: HastRoot) => visit(tree);
}

function rehypeResolveMarkdownResources() {
  return (tree: HastRoot, file: { data?: Record<string, unknown> }) => {
    const context = file.data?.markdownSourceContext as MarkdownSourceContext | undefined;
    if (!context) return;

    const visit = (node: HastNode): void => {
      if (isElement(node)) {
        const properties = node.properties;
        if (properties) {
          const assetAttributes: Record<string, string[]> = {
            img: ['src', 'srcSet'],
            source: ['src', 'srcSet'],
            video: ['src', 'poster'],
          };
          for (const attribute of assetAttributes[node.tagName] ?? []) {
            const value = properties[attribute];
            if (typeof value !== 'string') continue;
            const resolved = attribute === 'srcSet'
              ? resolveMarkdownSrcSet(value, context)
              : resolveMarkdownUrl(value, context, 'asset');
            if (resolved) properties[attribute] = resolved;
            else delete properties[attribute];
          }

          if (node.tagName === 'a' && typeof properties.href === 'string') {
            const resolved = resolveMarkdownUrl(properties.href, context, 'link');
            if (resolved) properties.href = resolved;
            else delete properties.href;
          }
        }
      }

      node.children?.forEach(visit);
    };

    visit(tree);
  };
}

/**
 * Give every Markdown table a document-local identity that does not depend on
 * its cell contents. The nearest heading path is stable while a table is
 * edited, while the ordinal disambiguates multiple tables in one section.
 */
function rehypeAssignTableIds() {
  return (tree: HastRoot) => {
    const headingCounts = new Map<number, number>();
    const tableCounts = new Map<string, number>();
    const headingPath: string[] = [];

    const visit = (node: HastNode): void => {
      if (isElement(node)) {
        const headingLevel = getHeadingLevel(node);
        if (headingLevel !== null) {
          while (headingPath.length > 0) {
            const currentLevel = Number.parseInt(headingPath[headingPath.length - 1]?.split(':', 1)[0] ?? '0', 10);
            if (currentLevel < headingLevel) break;
            headingPath.pop();
          }

          const occurrence = (headingCounts.get(headingLevel) ?? 0) + 1;
          headingCounts.set(headingLevel, occurrence);
          headingPath.push(`${headingLevel}:${occurrence}`);
        } else if (node.tagName === 'table') {
          const pathKey = headingPath.join('/') || 'root';
          const tableOrdinal = (tableCounts.get(pathKey) ?? 0) + 1;
          tableCounts.set(pathKey, tableOrdinal);
          node.properties ??= {};
          node.properties.dataFeishuTableId = `table-${hashStableTableIdentity(`${pathKey}:table-${tableOrdinal}`)}`;
          node.properties.dataFeishuTablePath = pathKey;
          node.properties.dataFeishuTableOrdinal = String(tableOrdinal);
        }
      }

      node.children?.forEach(visit);
    };

    visit(tree);
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // README files commonly use presentation-only HTML for badges, responsive
  // images, and contributor walls. Parse it first, then immediately apply
  // rehype-sanitize's GitHub-style allowlist before creating React elements.
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, markdownHtmlSchema)
  .use(rehypeNormalizeTaskCheckboxes)
  .use(rehypeResolveMarkdownResources)
  .use(rehypeAssignTableIds)
  .use(rehypeSectionHierarchy)
  .use(rehypeReact, {
    ...production,
    components: feishuComponents,
  });

export function parseMarkdown(content: string, sourceContext?: MarkdownSourceContext): ReactElement {
  // Keep Mermaid block indices stable for each parse round.
  resetMermaidRenderCounter();
  const file = processor.processSync({
    value: content,
    data: { markdownSourceContext: sourceContext },
  });
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
