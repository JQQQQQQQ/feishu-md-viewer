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

  it('keeps the collapse toggle outside the heading text flow and hidden until needed', () => {
    expect(stylesheet).toMatch(
      /\.feishu-heading__toggle\s*\{[^}]*position:\s*absolute;[^}]*left:\s*-[^;]+;[^}]*opacity:\s*0;/i,
    );
    expect(stylesheet).toMatch(
      /\.feishu-heading:hover\s+\.feishu-heading__toggle|\.feishu-heading__toggle:focus-visible/i,
    );
  });
});
