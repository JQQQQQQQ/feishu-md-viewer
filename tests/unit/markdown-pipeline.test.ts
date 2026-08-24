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

    it('renders safe raw HTML commonly used by project READMEs', () => {
      const result = parseMarkdown(`
<div align="center">
  <a href="https://github.com/ayangweb/EcoPaste">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://example.com/hero-dark.png" />
      <img src="https://example.com/hero-light.png" alt="EcoPaste" width="320" />
    </picture>
  </a>
  <a href="https://github.com/ayangweb/EcoPaste/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=ayangweb/EcoPaste" alt="贡献者" />
  </a>
</div>`);
      const { container } = render(result);

      expect(container.querySelector('div[align="center"]')).not.toBeNull();
      expect(container.querySelector('picture source')?.getAttribute('srcset')).toBe('https://example.com/hero-dark.png');
      expect(container.querySelector('img[alt="EcoPaste"]')?.getAttribute('src')).toBe('https://example.com/hero-light.png');
      expect(container.querySelector('img[alt="贡献者"]')?.getAttribute('src')).toBe('https://contrib.rocks/image?repo=ayangweb/EcoPaste');
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

    it('assigns stable ids to table blocks so content edits do not change their width key', () => {
      const first = render(parseMarkdown(`## Data

| A | B |
| --- | --- |
| 1 | 2 |`));
      const firstTableId = first.container.querySelector('.feishu-table__scrollport table')?.getAttribute('data-feishu-table-id');
      first.unmount();

      const edited = render(parseMarkdown(`## Data

| Changed A | Changed B |
| --- | --- |
| 10 | 20 |
| 30 | 40 |`));
      const editedTableId = edited.container.querySelector('.feishu-table__scrollport table')?.getAttribute('data-feishu-table-id');

      expect(firstTableId).toBeTruthy();
      expect(editedTableId).toBe(firstTableId);
      edited.unmount();
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

      fireEvent.mouseDown(cells[0] as HTMLTableCellElement, { altKey: true, buttons: 1, clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 108, clientY: 140 });
      fireEvent.mouseOver(cells[2] as HTMLTableCellElement, { clientX: 108, clientY: 140 });
      fireEvent.mouseUp(document, { clientX: 108, clientY: 140 });
      document.dispatchEvent(copyEvent);

      expect(setData).toHaveBeenCalledWith('text/plain', 'A\n1\n3');
      const htmlCall = setData.mock.calls.find((call) => call[0] === 'text/html');
      expect(htmlCall).toBeDefined();
      const html = String(htmlCall?.[1] ?? '');
      expect(html).toContain('<table style="');
      expect(html).toContain('<thead>');
      expect(html).toContain('<th scope="col" style="');
      expect(html).toContain('font-weight:600');
      expect(html).toContain('background:#f5f6f7');
      expect(html).toContain('<tbody>');
      expect(html).toContain('<td style="');
      expect(html).toContain('font-weight:400');
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

      fireEvent.mouseDown(cells[0] as HTMLTableCellElement, { altKey: true, buttons: 1 });
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

      fireEvent.mouseDown(cells[0] as HTMLTableCellElement, { altKey: true, buttons: 1, clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 108, clientY: 140 });
      fireEvent.mouseOver(cells[2] as HTMLTableCellElement, { clientX: 108, clientY: 140 });
      fireEvent.mouseUp(document, { clientX: 108, clientY: 140 });
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

      fireEvent.mouseDown(firstCell as HTMLTableCellElement, { altKey: true, buttons: 1 });
      fireEvent.keyDown(document, { key: 'a', ctrlKey: true });
      fireEvent.keyDown(document, { key: 'c', ctrlKey: true });

      expect(writeText).toHaveBeenCalledWith('A\tB\n1\t2\n3\t4');
    });

    it('handles GFM strikethrough', () => {
      const result = parseMarkdown('~~deleted~~');
      expect(result).toBeDefined();
    });

    it('marks task list checkboxes for high-contrast preview styling', () => {
      const result = parseMarkdown('- [ ] Todo\n\n- [x] Done');
      const findInputs = (node: unknown): Array<{ type?: unknown; props?: Record<string, unknown> }> => {
        if (!node || typeof node !== 'object') return [];
        const candidate = node as { type?: unknown; props?: Record<string, unknown> };
        if (candidate.props?.type === 'checkbox') return [candidate];
        const children = candidate.props?.children;
        return Array.isArray(children) ? children.flatMap(findInputs) : findInputs(children);
      };
      const checkboxes = findInputs(result);

      expect(checkboxes).toHaveLength(2);
      expect(typeof checkboxes[0]?.type).toBe('function');
      expect(checkboxes[0]?.props?.disabled).toBe(true);
      expect(checkboxes[0]?.props?.checked).toBe(false);
      expect(typeof checkboxes[1]?.type).toBe('function');
      expect(checkboxes[1]?.props?.disabled).toBe(true);
      expect(checkboxes[1]?.props?.checked).toBe(true);
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

    it('toggles only the linked section when clicking heading triangle', () => {
      const result = parseMarkdown(`## Parent

Parent body

### Child

Child body

## Next

Next body`);
      const { container } = render(result);
      const toggle = container.querySelector<HTMLButtonElement>('.feishu-h2 .feishu-heading__toggle');
      const sections = container.querySelectorAll<HTMLElement>('.feishu-section--level-2');
      const parentSection = sections[0];
      const nextSection = sections[1];
      const hiddenMarkerAttr = 'data-feishu-heading-hidden-by';

      expect(toggle).not.toBeNull();
      expect(parentSection?.hasAttribute(hiddenMarkerAttr)).toBe(false);
      expect(nextSection?.hasAttribute(hiddenMarkerAttr)).toBe(false);

      fireEvent.click(toggle as HTMLButtonElement);
      expect(parentSection?.hasAttribute(hiddenMarkerAttr)).toBe(true);
      expect(nextSection?.hasAttribute(hiddenMarkerAttr)).toBe(false);

      fireEvent.click(toggle as HTMLButtonElement);
      expect(parentSection?.hasAttribute(hiddenMarkerAttr)).toBe(false);
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

  it('resets rendered mermaid block indices on each parse', () => {
    const singleMermaid = parseMarkdown('```mermaid\ngraph TD\nA-->B\n```');
    const first = render(singleMermaid);
    const firstIndex = first.container.querySelector('.mermaid-toolbar-wrapper')?.getAttribute('data-mermaid-block-index');
    first.unmount();

    const secondMermaid = parseMarkdown('```mermaid\ngraph TD\nA-->B\n```');
    const second = render(secondMermaid);
    const secondIndex = second.container.querySelector('.mermaid-toolbar-wrapper')?.getAttribute('data-mermaid-block-index');
    second.unmount();

    expect(firstIndex).toBe('0');
    expect(secondIndex).toBe('0');
  });
});
