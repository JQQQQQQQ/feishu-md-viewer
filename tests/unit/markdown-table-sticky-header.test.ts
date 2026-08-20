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

  it('lets the table shrink or grow with explicit column widths instead of filling the wrapper', () => {
    expect(normalized).toMatch(
      /\.feishu-table\s*\{[^}]*width:\s*max-content;[^}]*min-width:\s*0;/i,
    );
  });

  it('lets the normal table wrapper shrink to the table content while capping overflow', () => {
    expect(normalized).toMatch(
      /\.feishu-table-wrapper\s*\{[^}]*width:\s*max-content;[^}]*max-width:\s*100%;/i,
    );
  });

  it('reserves the native scrollbar height below the non-interactive reveal layer', () => {
    expect(normalized).toMatch(
      /\.feishu-table__left-reveal\s*\{[^}]*width:\s*var\(--feishu-table-left-reveal,\s*0px\);[^}]*height:\s*calc\(100%\s*-\s*var\(--feishu-table-scrollbar-height,\s*0px\)\);/i,
    );
  });

  it('offsets the reveal clone and extended column rail by the derived main-scroll remainder', () => {
    expect(normalized).toMatch(
      /\.feishu-table__left-reveal\s+\.feishu-table\s*\{[^}]*transform:\s*translateX\(calc\(-1\s*\*\s*var\(--feishu-table-left-reveal-content-offset,\s*0px\)\)\);/i,
    );
    expect(normalized).toMatch(
      /\.feishu-table__selection-rail--top\s*>\s*\.feishu-table__selection-rail-segment\s*\{[^}]*var\(--feishu-table-left-reveal-content-offset,\s*0px\)/i,
    );
  });

  it('provides a fixed left-reveal clone for the sticky header without a visible seam', () => {
    expect(normalized).toMatch(
      /\.feishu-table__sticky-left-reveal\s*\{[^}]*position:\s*fixed;[^}]*overflow:\s*hidden;[^}]*pointer-events:\s*none;/i,
    );
    expect(normalized).toMatch(
      /\.feishu-table__sticky-head--with-left-reveal\s*\{[^}]*border-left-color:\s*transparent;/i,
    );
  });

  it('keeps the existing wide-table mode in charge during a resize', () => {
    expect(normalized).not.toMatch(/\.feishu-table-wrapper--resizing\s*\{/i);
    expect(normalized).toMatch(
      /\.feishu-table-wrapper--wide-right,\s*\.feishu-table-wrapper--wide-balanced\s*\{[^}]*width:\s*min\(var\(--feishu-table-wide-width/i,
    );
  });
});
