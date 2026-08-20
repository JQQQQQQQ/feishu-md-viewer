import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const stylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/layout.css'),
  'utf8',
).replace(/\s+/g, ' ');
const markdownStylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/markdown.css'),
  'utf8',
).replace(/\s+/g, ' ');
const scrollbarStylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/scrollbar.css'),
  'utf8',
).replace(/\s+/g, ' ');

describe('table of contents styles', () => {
  it('keeps major headings bold while they are active', () => {
    expect(stylesheet).toMatch(/\.feishu-toc__link--active\.feishu-toc__link--major\s*\{[^}]*font-weight:\s*700/);
  });

  it('makes major headings darker and heavier in the default state', () => {
    expect(stylesheet).toMatch(/\.feishu-toc__link--major\s*\{[^}]*font-weight:\s*700/);
    expect(stylesheet).toMatch(/\.feishu-toc__link--major\s*\{[^}]*color:\s*var\(--feishu-text-primary\)/);
  });

  it('extends the table frame into the left reveal without moving the scrollport', () => {
    expect(markdownStylesheet).toMatch(/\.feishu-table__left-reveal::before\s*\{[^}]*border-left:\s*1px solid var\(--feishu-border-light\)/);
    expect(markdownStylesheet).toMatch(/\.feishu-table__left-reveal::before\s*\{[^}]*border-top:\s*1px solid var\(--feishu-border-light\)/);
    expect(markdownStylesheet).toMatch(/\.feishu-table__left-reveal::before\s*\{[^}]*border-bottom:\s*1px solid var\(--feishu-border-light\)/);
  });

  it('hides the original left frame only while the left reveal is active', () => {
    expect(markdownStylesheet).toMatch(/\.feishu-table-wrapper--left-revealed\s*\{[^}]*border-left-color:\s*transparent/);
    expect(markdownStylesheet).toMatch(/\.feishu-table__left-reveal\s*\{[^}]*pointer-events:\s*auto/);
    expect(markdownStylesheet).toMatch(/\.feishu-table__left-reveal\s*\{[^}]*user-select:\s*text/);
  });

  it('extends the clickable top column rail over the left reveal using the displayed content offset', () => {
    expect(markdownStylesheet).toMatch(/\.feishu-table__selection-rail--top\s*\{[^}]*left:\s*calc\(-1 \* var\(--feishu-table-left-reveal, 0px\)\)/);
    expect(markdownStylesheet).toMatch(/\.feishu-table__selection-rail--top > \.feishu-table__selection-rail-segment\s*\{[^}]*--feishu-table-left-reveal-content-offset/);
  });

  it('extends the clickable left row rail over the left reveal', () => {
    expect(markdownStylesheet).toMatch(/\.feishu-table__selection-rail--left\s*\{[^}]*left:\s*calc\(-1 \* var\(--feishu-table-left-reveal, 0px\)\)/);
  });

  it('uses one white reading surface for every data row instead of zebra stripes', () => {
    expect(markdownStylesheet).toMatch(/\.feishu-table__row\s*\{[^}]*background-color:\s*var\(--feishu-bg-content\)/);
    expect(markdownStylesheet).not.toMatch(/\.feishu-table__row:nth-child\(even\)/);
  });

  it('paints the table header background on every header cell', () => {
    expect(markdownStylesheet).toMatch(/\.feishu-table__header\s*\{[^}]*background-color:\s*var\(--feishu-table-header-bg\)/);
  });

  it('clips table content to the outer frame corners in both normal and left-reveal states', () => {
    expect(markdownStylesheet).toMatch(/\.feishu-table__scrollport\s*\{[^}]*border-radius:\s*inherit/);
    expect(markdownStylesheet).toMatch(/\.feishu-table__left-reveal\s*\{[^}]*border-radius:\s*var\(--feishu-radius\) 0 0 var\(--feishu-radius\)/);
  });

  it('removes only the inner scrollport left corners while the left reveal owns the outer frame', () => {
    expect(markdownStylesheet).toMatch(/\.feishu-table-wrapper--left-revealed\s+\.feishu-table__scrollport\s*\{[^}]*border-radius:\s*0 var\(--feishu-radius\) var\(--feishu-radius\) 0/);
  });

  it('removes the original outer-frame left corners while the left reveal owns them', () => {
    expect(markdownStylesheet).toMatch(/\.feishu-table-wrapper--left-revealed\s*\{[^}]*border-radius:\s*0 var\(--feishu-radius\) var\(--feishu-radius\) 0/);
  });

  it('draws the table frame without consuming layout space so it aligns with the reveal', () => {
    expect(markdownStylesheet).toMatch(/\.feishu-table-wrapper\s*\{[^}]*border:\s*none/);
    expect(markdownStylesheet).toMatch(/\.feishu-table-wrapper::after\s*\{[^}]*inset:\s*0;[^}]*border:\s*1px solid var\(--feishu-border-light\)/);
    expect(markdownStylesheet).toMatch(/\.feishu-table-wrapper--left-revealed::after\s*\{[^}]*border-left-color:\s*transparent/);
  });

  it('uses edge shadows only for table directions that still contain hidden content', () => {
    expect(markdownStylesheet).toMatch(/\.feishu-table-wrapper--can-scroll-right::after\s*\{[^}]*box-shadow:\s*inset -/);
    expect(markdownStylesheet).toMatch(/\.feishu-table-wrapper--can-scroll-left\s+\.feishu-table__left-reveal::before\s*\{[^}]*box-shadow:\s*inset/);
  });

  it('uses the content surface below a hidden desktop sidebar', () => {
    expect(stylesheet).toMatch(/\.feishu-app-shell__body::before\s*\{[^}]*width:\s*var\(--feishu-main-offset\)/);
    expect(stylesheet).toMatch(/\.feishu-app-shell__body::before\s*\{[^}]*background-color:\s*var\(--feishu-bg-content\)/);
  });

  it('hides navigation scrollbars until the directory is hovered or receives keyboard focus', () => {
    expect(scrollbarStylesheet).toMatch(/\.feishu-viewer \.feishu-sidebar,\s*\.feishu-viewer \.feishu-toc\s*\{[^}]*scrollbar-width:\s*none/);
    expect(scrollbarStylesheet).toMatch(/\.feishu-viewer \.feishu-sidebar::-webkit-scrollbar,\s*\.feishu-viewer \.feishu-toc::-webkit-scrollbar\s*\{[^}]*width:\s*0/);
    expect(scrollbarStylesheet).toMatch(/\.feishu-viewer \.feishu-sidebar:hover,\s*\.feishu-viewer \.feishu-sidebar:focus-within,\s*\.feishu-viewer \.feishu-sidebar:hover \.feishu-toc,\s*\.feishu-viewer \.feishu-sidebar:focus-within \.feishu-toc\s*\{[^}]*scrollbar-width:\s*thin/);
    expect(scrollbarStylesheet).toMatch(/\.feishu-viewer \.feishu-sidebar:hover::-webkit-scrollbar,\s*\.feishu-viewer \.feishu-sidebar:focus-within::-webkit-scrollbar,\s*\.feishu-viewer \.feishu-sidebar:hover \.feishu-toc::-webkit-scrollbar,\s*\.feishu-viewer \.feishu-sidebar:focus-within \.feishu-toc::-webkit-scrollbar\s*\{[^}]*width:\s*8px/);
  });

});
