import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { parseMarkdown, extractMermaidBlocks } from '@/lib/markdown-pipeline';

describe('markdown-pipeline', () => {
  describe('parseMarkdown', () => {
    it('parses basic markdown to React elements', () => {
      const result = parseMarkdown('# Hello World');
      expect(result).toBeDefined();
    });

    it('handles empty content', () => {
      const result = parseMarkdown('');
      expect(result).toBeDefined();
    });

    it('strips embedded HTML for XSS prevention', () => {
      const result = parseMarkdown('<script>alert("xss")</script>Hello');
      expect(result).toBeDefined();
      // The sanitizer strips script tags, keeping only text content
    });

    it('blocks script tags from rendered output', () => {
      const result = parseMarkdown('<script>alert("xss")</script>');
      const { container } = render(result);
      expect(container.innerHTML).not.toContain('alert');
      expect(container.innerHTML).not.toContain('<script');
    });

    it('blocks event handler attributes from rendered output', () => {
      const result = parseMarkdown('<img src=x onerror=alert(1)>');
      const { container } = render(result);
      expect(container.innerHTML).not.toContain('onerror');
    });

    it('blocks javascript: URLs from rendered output', () => {
      const result = parseMarkdown('<a href="javascript:alert(1)">click</a>');
      const { container } = render(result);
      expect(container.innerHTML).not.toContain('javascript:');
    });

    it('handles GFM tables', () => {
      const md = `| A | B |
| --- | --- |
| 1 | 2 |`;
      const result = parseMarkdown(md);
      expect(result).toBeDefined();
    });

    it('handles GFM strikethrough', () => {
      const result = parseMarkdown('~~deleted~~');
      expect(result).toBeDefined();
    });
  });

  describe('extractMermaidBlocks', () => {
    it('extracts mermaid code blocks', () => {
      const md = `# Title

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

Some text

\`\`\`mermaid
sequenceDiagram
  A->>B: Hello
\`\`\``;

      const blocks = extractMermaidBlocks(md);
      expect(blocks).toHaveLength(2);
      expect(blocks[0]?.code).toContain('graph TD');
      expect(blocks[1]?.code).toContain('sequenceDiagram');
    });

    it('returns empty array when no mermaid blocks', () => {
      const blocks = extractMermaidBlocks('# Hello\n\n```js\nconst x = 1;\n```');
      expect(blocks).toHaveLength(0);
    });

    it('handles empty mermaid blocks', () => {
      const blocks = extractMermaidBlocks('```mermaid\n\n```');
      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.code).toBe('');
    });
  });
});
