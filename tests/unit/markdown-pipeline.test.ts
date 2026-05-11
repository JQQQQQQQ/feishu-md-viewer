import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
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
      const { container } = render(result);

      expect(container.querySelector('.feishu-table')).not.toBeNull();
      expect(container.querySelector('.feishu-table__cell')).not.toBeNull();
    });

    it('copies a selected table column as tabular text', () => {
      const md = `| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |`;
      const result = parseMarkdown(md);
      const { container } = render(result);
      const cells = container.querySelectorAll<HTMLTableCellElement>('td');
      const setData = vi.fn();
      const copyEvent = new Event('copy', { bubbles: true, cancelable: true });

      Object.defineProperty(copyEvent, 'clipboardData', {
        value: { setData },
      });

      fireEvent.mouseDown(cells[0] as HTMLTableCellElement);
      fireEvent.mouseOver(cells[2] as HTMLTableCellElement);
      fireEvent.mouseUp(document);
      document.dispatchEvent(copyEvent);

      expect(setData).toHaveBeenCalledWith('text/plain', 'A\n1\n3');
      expect(setData).toHaveBeenCalledWith('text/html', '<table><tbody><tr><th>A</th></tr><tr><td>1</td></tr><tr><td>3</td></tr></tbody></table>');
    });

    it('keeps table selection when shadow DOM retargets document mousedown', () => {
      const md = `| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |`;
      const result = parseMarkdown(md);
      const { container } = render(result);
      const cells = container.querySelectorAll<HTMLTableCellElement>('td');
      const wrapper = container.querySelector('.feishu-table-wrapper');
      const setData = vi.fn();
      const shadowMouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      const copyEvent = new Event('copy', { bubbles: true, cancelable: true });

      Object.defineProperty(shadowMouseDown, 'composedPath', {
        value: () => [cells[0], wrapper, document],
      });
      Object.defineProperty(copyEvent, 'clipboardData', {
        value: { setData },
      });

      fireEvent.mouseDown(cells[0] as HTMLTableCellElement);
      document.dispatchEvent(shadowMouseDown);
      document.dispatchEvent(copyEvent);

      expect(setData).toHaveBeenCalledWith('text/plain', '1');
    });

    it('copies a selected table column with keyboard shortcut fallback', () => {
      const md = `| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |`;
      const result = parseMarkdown(md);
      const { container } = render(result);
      const cells = container.querySelectorAll<HTMLTableCellElement>('td');
      const writeText = vi.fn();

      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      fireEvent.mouseDown(cells[0] as HTMLTableCellElement);
      fireEvent.mouseOver(cells[2] as HTMLTableCellElement);
      fireEvent.mouseUp(document);
      fireEvent.keyDown(document, { key: 'c', ctrlKey: true });

      expect(writeText).toHaveBeenCalledWith('A\n1\n3');
    });

    it('selects the whole focused table with keyboard shortcut fallback', () => {
      const md = `| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |`;
      const result = parseMarkdown(md);
      const { container } = render(result);
      const firstCell = container.querySelector<HTMLTableCellElement>('td');
      const writeText = vi.fn();

      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      fireEvent.mouseDown(firstCell as HTMLTableCellElement);
      fireEvent.keyDown(document, { key: 'a', ctrlKey: true });
      fireEvent.keyDown(document, { key: 'c', ctrlKey: true });

      expect(writeText).toHaveBeenCalledWith('A\tB\n1\t2\n3\t4');
    });

    it('handles GFM strikethrough', () => {
      const result = parseMarkdown('~~deleted~~');
      expect(result).toBeDefined();
    });

    it('wraps heading content in hierarchy sections', () => {
      const result = parseMarkdown(`# Title

Intro

## Parent

Parent body

### Child

Child body

## Next

Next body`);
      const { container } = render(result);
      const level2Sections = container.querySelectorAll('.feishu-section--level-2');
      const level3Sections = container.querySelectorAll('.feishu-section--level-3');

      expect(level2Sections).toHaveLength(2);
      expect(level3Sections).toHaveLength(1);
      expect(level2Sections[0]?.textContent).toContain('Parent body');
      expect(level2Sections[0]?.textContent).toContain('Child');
      expect(level2Sections[0]?.textContent).not.toContain('Next body');
      expect(level3Sections[0]?.textContent).toContain('Child body');
    });

    it('renders GitHub-style callout blockquotes', () => {
      const result = parseMarkdown(`> [!WARNING]
> Check this before publishing.`);
      const { container } = render(result);
      const callout = container.querySelector('.feishu-callout--warning');

      expect(callout).not.toBeNull();
      expect(callout?.textContent).toContain('Warning');
      expect(callout?.textContent).toContain('Check this before publishing.');
      expect(callout?.textContent).not.toContain('[!WARNING]');
    });

    it('supports all callout variants', () => {
      const result = parseMarkdown(`> [!NOTE]
> Note text

> [!TIP]
> Tip text

> [!IMPORTANT]
> Important text

> [!CAUTION]
> Caution text`);
      const { container } = render(result);

      expect(container.querySelector('.feishu-callout--note')).not.toBeNull();
      expect(container.querySelector('.feishu-callout--tip')).not.toBeNull();
      expect(container.querySelector('.feishu-callout--important')).not.toBeNull();
      expect(container.querySelector('.feishu-callout--caution')).not.toBeNull();
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
