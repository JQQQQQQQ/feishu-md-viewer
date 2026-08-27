import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('GitHub Markdown compatibility documents', () => {
  it('fixture covers the README structures in the design', async () => {
    const fixture = await readFile('test-markdown-compatibility.md', 'utf8');
    for (const token of [
      '<details>',
      '<picture>',
      '<kbd>',
      '<video ',
      'contrib.rocks',
      '<table>',
      '<div',
      'loading="lazy"',
      '[跳到表格](#html-table)',
      'raw.githubusercontent.com',
    ]) {
      expect(fixture).toContain(token);
    }
  });

  it('matrix records a decision for each P0/P1 item', async () => {
    const matrix = await readFile('docs/markdown-compatibility.md', 'utf8');
    for (const token of [
      'details / summary',
      'picture / source',
      'kbd',
      'video',
      'HTML table',
      '相对图片',
      'GitHub blob',
      'GitHub raw',
      'GitLab',
      'internal anchor',
      'PASS',
      'DEGRADED',
      'UNSUPPORTED',
    ]) {
      expect(matrix).toContain(token);
    }
  });
});
