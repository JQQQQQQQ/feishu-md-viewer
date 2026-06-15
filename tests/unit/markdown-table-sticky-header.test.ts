import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/markdown.css'),
  'utf-8',
);

const normalized = stylesheet.replace(/\s+/g, ' ');

describe('markdown table sticky header styles', () => {
  it('defines a fixed sticky header host for reading mode tables', () => {
    expect(normalized).toMatch(
      /\.feishu-table__sticky-head\s*\{[^}]*position:\s*fixed;[^}]*display:\s*none;[^}]*pointer-events:\s*none;[^}]*z-index:\s*80;/i,
    );
  });

  it('keeps sticky clone headers as static cells to avoid nested sticky behavior', () => {
    expect(normalized).toMatch(
      /\.feishu-table__sticky-head\s+\.feishu-table__header\s*\{[^}]*position:\s*static;[^}]*top:\s*auto;/i,
    );
  });
});
