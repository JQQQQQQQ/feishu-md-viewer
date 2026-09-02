import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/markdown.css'),
  'utf-8',
).replace(/\s+/g, ' ');
const theme = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/feishu-theme.css'),
  'utf-8',
).replace(/\s+/g, ' ');
const darkTheme = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/dark-theme.css'),
  'utf-8',
).replace(/\s+/g, ' ');

describe('markdown section layout', () => {
  it('keeps heading sections on the shared document content edge', () => {
    expect(stylesheet).not.toMatch(
      /\.feishu-section--level-[2-6][^{]*\{[^}]*margin-left\s*:/i,
    );
    expect(stylesheet).not.toMatch(
      /\.feishu-section--level-[2-6][^{]*\{[^}]*padding-left\s*:/i,
    );
  });

  it('uses stronger heading weights for clear reading hierarchy', () => {
    expect(stylesheet).toMatch(/\.feishu-heading\s*\{[^}]*font-weight:\s*700;/i);
    expect(stylesheet).toMatch(/\.feishu-h1\s*\{[^}]*font-weight:\s*750;/i);
    expect(stylesheet).toMatch(/\.feishu-h2\s*\{[^}]*font-weight:\s*700;/i);
    expect(stylesheet).toMatch(/\.feishu-h3\s*\{[^}]*font-weight:\s*700;/i);
  });

  it('uses larger heading sizes for stronger visual hierarchy', () => {
    expect(theme).toMatch(/--feishu-font-size-h1:\s*36px;/i);
    expect(theme).toMatch(/--feishu-font-size-h2:\s*30px;/i);
    expect(theme).toMatch(/--feishu-font-size-h3:\s*24px;/i);
    expect(theme).toMatch(/--feishu-font-size-h4:\s*20px;/i);
    expect(stylesheet).toMatch(/\.feishu-h5\s*\{[^}]*font-size:\s*18px;/i);
    expect(stylesheet).toMatch(/\.feishu-h6\s*\{[^}]*font-size:\s*16px;/i);
  });

  it('让正文和表格都使用可调的正文字号变量', () => {
    expect(stylesheet).toMatch(
      /\.feishu-markdown-body\s*\{[^}]*font-size:\s*var\(--feishu-font-size-body\);/i,
    );
    expect(stylesheet).toMatch(
      /\.feishu-table\s*\{[^}]*font-size:\s*var\(--feishu-font-size-body\);/i,
    );
  });

  it('让内嵌代码使用中性的灰色配色，同时保留代码块独立配色', () => {
    expect(theme).toMatch(/--feishu-inline-code-bg:\s*#f0f1f3;/i);
    expect(theme).toMatch(/--feishu-inline-code-text:\s*#3b4350;/i);
    expect(theme).toMatch(/--feishu-inline-code-border:\s*#d0d3d8;/i);
    expect(darkTheme).toMatch(/\.feishu-viewer--dark\s*\{[^}]*--feishu-inline-code-bg:\s*#3a3a3a;[^}]*--feishu-inline-code-text:\s*#d8dee9;[^}]*--feishu-inline-code-border:\s*#4a4a4a;/i);
    expect(stylesheet).toMatch(
      /\.feishu-inline-code\s*\{[^}]*color:\s*var\(--feishu-inline-code-text/,
    );
    expect(stylesheet).toMatch(
      /\.feishu-inline-code\s*\{[^}]*border:\s*1px\s+solid\s+var\(--feishu-inline-code-border/,
    );
  });

  it('让暗色主题的整体阅读底色更深，同时保持页面和正文两层层次', () => {
    expect(darkTheme).toMatch(/\.feishu-viewer--dark\s*\{[^}]*--feishu-bg-page:\s*#121212;[^}]*--feishu-bg-content:\s*#1c1c1c;/i);
    expect(darkTheme).toMatch(/\.feishu-viewer--system\s*\{[^}]*--feishu-bg-page:\s*#121212;[^}]*--feishu-bg-content:\s*#1c1c1c;/i);
  });

  it('keeps the collapse toggle outside the heading text flow and hidden until needed', () => {
    expect(stylesheet).toMatch(
      /\.feishu-heading__toggle\s*\{[^}]*position:\s*absolute;[^}]*left:\s*-[^;]+;[^}]*opacity:\s*0;/i,
    );
    expect(stylesheet).toMatch(
      /\.feishu-heading:hover\s+\.feishu-heading__toggle|\.feishu-heading__toggle:focus-visible/i,
    );
  });
});
