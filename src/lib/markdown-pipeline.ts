import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeReact from 'rehype-react';
import * as prod from 'react/jsx-runtime';
import DOMPurify from 'dompurify';
import { feishuComponents } from '../viewer/components/Markdown/FeishuComponents';
import type { ReactElement } from 'react';

const production = { Fragment: prod.Fragment, jsx: prod.jsx, jsxs: prod.jsxs };

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeReact, {
    ...production,
    components: feishuComponents,
  });

export function parseMarkdown(content: string): ReactElement {
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  });

  const file = processor.processSync(sanitized);
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
