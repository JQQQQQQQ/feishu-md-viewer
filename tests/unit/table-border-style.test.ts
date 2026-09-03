import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const markdownStylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/markdown.css'),
  'utf8',
).replace(/\s+/g, ' ');
const lightThemeStylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/feishu-theme.css'),
  'utf8',
).replace(/\s+/g, ' ');
const darkThemeStylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/dark-theme.css'),
  'utf8',
).replace(/\s+/g, ' ');

describe('表格单元格边框颜色', () => {
  it('uses a dedicated grid border color in both themes', () => {
    expect(lightThemeStylesheet).toMatch(/--feishu-table-cell-border:\s*#/);
    expect(darkThemeStylesheet).toMatch(/--feishu-table-cell-border:\s*#/);
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__cell\s*\{[^}]*border-right:\s*1px solid var\(--feishu-table-cell-border(?:,\s*var\(--feishu-border-lighter\))?\)/,
    );
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__cell\s*\{[^}]*border-bottom:\s*1px solid var\(--feishu-table-cell-border(?:,\s*var\(--feishu-border-lighter\))?\)/,
    );
  });

  it('keeps the table frame and header on their existing border hierarchy', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-table-wrapper::after\s*\{[^}]*border:\s*1px solid var\(--feishu-border-light\)/,
    );
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__header\s*\{[^}]*border-right:\s*1px solid var\(--feishu-border-light\)/,
    );
  });
});
