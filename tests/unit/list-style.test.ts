import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const stylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/markdown.css'),
  'utf8',
).replace(/\s+/g, ' ');

describe('嵌套列表样式', () => {
  it('reduces repeated spacing and indentation for nested lists', () => {
    expect(stylesheet).toMatch(
      /\.feishu-list\s+\.feishu-list\s*\{[^}]*padding-left:\s*1\.25em[^}]*margin:\s*0\.125em\s+0/,
    );
  });

  it('keeps the outer list spacing unchanged', () => {
    expect(stylesheet).toMatch(
      /\.feishu-list\s*\{[^}]*padding-left:\s*1\.5em[^}]*margin:\s*0\.75em\s+0/,
    );
  });
});
