import { describe, expect, it } from 'vitest';
import {
  diffMarkdownBlocks,
  indexMarkdownBlocks,
} from '@/lib/markdown-blocks';

describe('markdown-blocks', () => {
  it('keeps blank lines inside fenced Mermaid blocks', () => {
    const blocks = indexMarkdownBlocks('```mermaid\ngraph TD\n\nA-->B\n```');

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'mermaid', startLine: 1, endLine: 5 });
    expect(blocks[0]?.source).toContain('A-->B');
  });

  it('recognizes fenced code, indented code, nested lists and blockquotes', () => {
    const blocks = indexMarkdownBlocks([
      '```js',
      'const value = 1;',
      '```',
      '',
      '    const indented = true;',
      '',
      '- parent',
      '  - child',
      '',
      '> first',
      '> second',
    ].join('\n'));

    expect(blocks.map((block) => block.kind)).toEqual(['code', 'code', 'list', 'blockquote']);
    expect(blocks[2]).toMatchObject({ startLine: 7, endLine: 8 });
    expect(blocks[3]).toMatchObject({ startLine: 10, endLine: 11 });
  });

  it('recognizes a GFM table only when the separator row follows the header', () => {
    const blocks = indexMarkdownBlocks([
      '| Name | Value |',
      '| :--- | ---: |',
      '| A | 1 |',
      '| B | 2 |',
    ].join('\n'));

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'table', startLine: 1, endLine: 4 });
  });

  it('keeps paired HTML details as one safe block and marks an unclosed pair unsafe', () => {
    const safe = indexMarkdownBlocks('<details>\n<summary>More</summary>\nBody\n</details>');
    const unsafe = indexMarkdownBlocks('<details>\n<summary>More</summary>\nBody');

    expect(safe).toHaveLength(1);
    expect(safe[0]).toMatchObject({ kind: 'html', boundaryConfidence: 'safe' });
    expect(unsafe).toHaveLength(1);
    expect(unsafe[0]).toMatchObject({ kind: 'unknown', boundaryConfidence: 'unsafe' });
  });

  it('classifies image-only, thematic-break, heading and paragraph blocks', () => {
    const blocks = indexMarkdownBlocks([
      '# Title',
      '',
      '![Preview](./preview.png)',
      '',
      '---',
      '',
      'A paragraph.',
    ].join('\n'));

    expect(blocks.map((block) => block.kind)).toEqual(['heading', 'image', 'thematic-break', 'paragraph']);
  });

  it('reuses the old render key when an unchanged table moves after an inserted block', () => {
    const before = indexMarkdownBlocks('# Data\n\n| A | B |\n| --- | --- |\n| 1 | 2 |');
    const after = indexMarkdownBlocks('# Data\n\nInserted.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |');
    const tableBefore = before.find((block) => block.kind === 'table');
    const tableAfter = after.find((block) => block.kind === 'table');
    const diff = diffMarkdownBlocks(before, after);

    expect(tableBefore).toBeDefined();
    expect(tableAfter).toBeDefined();
    expect(diff.requiresFullParse).toBe(false);
    expect(diff.unchanged.find((block) => block.kind === 'table')?.renderKey).toBe(tableBefore?.renderKey);
    expect(diff.added).toHaveLength(1);
  });

  it('classifies a paragraph edit and an unsafe fence as full fallback', () => {
    const before = indexMarkdownBlocks('A\n\nB');
    const after = indexMarkdownBlocks('A\n\nChanged');
    const changed = diffMarkdownBlocks(before, after);

    expect(changed.changed).toHaveLength(1);
    expect(changed.changed[0]?.previous.source).toBe('B');
    expect(changed.changed[0]?.next.source).toBe('Changed');

    const unsafe = diffMarkdownBlocks(
      indexMarkdownBlocks('```js\nconst a = 1;\n```'),
      indexMarkdownBlocks('```js\nconst a = 2;'),
    );
    expect(unsafe.requiresFullParse).toBe(true);
    expect(unsafe.fallbackReason).toContain('边界');
  });

  it('falls back when a heading changes because downstream heading paths are invalidated', () => {
    const diff = diffMarkdownBlocks(
      indexMarkdownBlocks('# Old\n\n## Child'),
      indexMarkdownBlocks('# New\n\n## Child'),
    );

    expect(diff.requiresFullParse).toBe(true);
    expect(diff.fallbackReason).toContain('标题');
  });
});
