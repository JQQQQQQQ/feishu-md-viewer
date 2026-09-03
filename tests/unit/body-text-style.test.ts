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

describe('正文文字颜色', () => {
  it('uses a dedicated body text color that is slightly lighter than primary text', () => {
    expect(lightThemeStylesheet).toMatch(/--feishu-text-body:\s*#353b45/);
    expect(darkThemeStylesheet).toMatch(/--feishu-text-body:\s*#/);
    expect(markdownStylesheet).toMatch(
      /\.feishu-markdown-body\s*\{[^}]*color:\s*var\(--feishu-text-body\)/,
    );
  });

  it('keeps headings and code blocks on their dedicated stronger colors', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-heading\s*\{[^}]*color:\s*var\(--feishu-text-primary\)/,
    );
    expect(markdownStylesheet).toMatch(
      /\.feishu-code-block__pre\s*\{[^}]*color:\s*var\(--feishu-text-primary\)/,
    );
  });

  it('uses the primary text color for bold inline content', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-markdown-body\s+(?:strong|b),\s*\.feishu-markdown-body\s+(?:strong|b)\s*\{[^}]*color:\s*var\(--feishu-text-primary\)/,
    );
  });
});
