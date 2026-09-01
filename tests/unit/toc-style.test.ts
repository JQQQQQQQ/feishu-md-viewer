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
const darkThemeStylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/dark-theme.css'),
  'utf8',
).replace(/\s+/g, ' ');

describe('table of contents styles', () => {
  it('uses only text color for active items while major headings stay bold', () => {
    const activeRule = stylesheet.match(/\.feishu-toc__link--active\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(activeRule).toMatch(/color:\s*var\(--feishu-brand-primary\)/);
    expect(activeRule).not.toMatch(/background-color|border-left|font-weight/);
  });

  it('makes major headings darker and heavier in the default state', () => {
    expect(stylesheet).toMatch(/\.feishu-toc__link--major\s*\{[^}]*font-weight:\s*700/);
    expect(stylesheet).toMatch(
      /\.feishu-toc__link--major\s*\{[^}]*color:\s*var\(--feishu-text-primary\)/,
    );
  });

  it('allows the directory item font size to follow the reading setting', () => {
    expect(stylesheet).toMatch(
      /\.feishu-toc__link\s*\{[^}]*font-size:\s*var\(--feishu-toc-font-size,\s*13px\)/,
    );
  });

  it('extends the table frame into the left reveal without moving the scrollport', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__left-reveal::before\s*\{[^}]*border-left:\s*1px solid var\(--feishu-border-light\)/,
    );
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__left-reveal::before\s*\{[^}]*border-top:\s*1px solid var\(--feishu-border-light\)/,
    );
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__left-reveal::before\s*\{[^}]*border-bottom:\s*1px solid var\(--feishu-border-light\)/,
    );
  });

  it('hides the original left frame only while the left reveal is active', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-table-wrapper--left-revealed\s*\{[^}]*border-left-color:\s*transparent/,
    );
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__left-reveal\s*\{[^}]*pointer-events:\s*auto/,
    );
    expect(markdownStylesheet).toMatch(/\.feishu-table__left-reveal\s*\{[^}]*user-select:\s*text/);
  });

  it('extends the clickable top column rail over the left reveal using the displayed content offset', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__selection-rail--top\s*\{[^}]*left:\s*calc\(-1 \* var\(--feishu-table-left-reveal, 0px\)\)/,
    );
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__selection-rail--top > \.feishu-table__selection-rail-segment\s*\{[^}]*--feishu-table-left-reveal-content-offset/,
    );
  });

  it('extends the clickable left row rail over the left reveal', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__selection-rail--left\s*\{[^}]*left:\s*calc\(-1 \* var\(--feishu-table-left-reveal, 0px\)\)/,
    );
  });

  it('uses one white reading surface for every data row instead of zebra stripes', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__row\s*\{[^}]*background-color:\s*var\(--feishu-bg-content\)/,
    );
    expect(markdownStylesheet).not.toMatch(/\.feishu-table__row:nth-child\(even\)/);
  });

  it('paints the table header background on every header cell', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__header\s*\{[^}]*background-color:\s*var\(--feishu-table-header-bg\)/,
    );
  });

  it('clips table content to the outer frame corners in both normal and left-reveal states', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__scrollport\s*\{[^}]*border-radius:\s*inherit/,
    );
    expect(markdownStylesheet).toMatch(
      /\.feishu-table__left-reveal\s*\{[^}]*border-radius:\s*var\(--feishu-radius\) 0 0 var\(--feishu-radius\)/,
    );
  });

  it('removes only the inner scrollport left corners while the left reveal owns the outer frame', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-table-wrapper--left-revealed\s+\.feishu-table__scrollport\s*\{[^}]*border-radius:\s*0 var\(--feishu-radius\) var\(--feishu-radius\) 0/,
    );
  });

  it('removes the original outer-frame left corners while the left reveal owns them', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-table-wrapper--left-revealed\s*\{[^}]*border-radius:\s*0 var\(--feishu-radius\) var\(--feishu-radius\) 0/,
    );
  });

  it('draws the table frame without consuming layout space so it aligns with the reveal', () => {
    expect(markdownStylesheet).toMatch(/\.feishu-table-wrapper\s*\{[^}]*border:\s*none/);
    expect(markdownStylesheet).toMatch(
      /\.feishu-table-wrapper::after\s*\{[^}]*inset:\s*0;[^}]*border:\s*1px solid var\(--feishu-border-light\)/,
    );
    expect(markdownStylesheet).toMatch(
      /\.feishu-table-wrapper--left-revealed::after\s*\{[^}]*border-left-color:\s*transparent/,
    );
  });

  it('uses edge shadows only for table directions that still contain hidden content', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-table-wrapper--can-scroll-right::after\s*\{[^}]*box-shadow:\s*inset -/,
    );
    expect(markdownStylesheet).toMatch(
      /\.feishu-table-wrapper--can-scroll-left\s+\.feishu-table__left-reveal::before\s*\{[^}]*box-shadow:\s*inset/,
    );
  });

  it('uses the content surface below a hidden desktop sidebar', () => {
    expect(stylesheet).toMatch(
      /\.feishu-app-shell__body::before\s*\{[^}]*width:\s*var\(--feishu-main-offset\)/,
    );
    expect(stylesheet).toMatch(
      /\.feishu-app-shell__body::before\s*\{[^}]*background-color:\s*var\(--feishu-bg-content\)/,
    );
  });

  it('keeps the dark sidebar on the same surface as the reading content', () => {
    expect(darkThemeStylesheet).toMatch(
      /\.feishu-viewer--dark \.feishu-sidebar\s*\{[^}]*background-color:\s*var\(--feishu-bg-content\)/,
    );
    expect(darkThemeStylesheet).toMatch(
      /\.feishu-viewer--system \.feishu-sidebar\s*\{[^}]*background-color:\s*var\(--feishu-bg-content\)/,
    );
  });

  it('uses one stable-width directory scrollport whose thumb appears without shifting content', () => {
    expect(stylesheet).toMatch(/\.feishu-toc\s*\{[^}]*height:\s*auto;[^}]*overflow:\s*visible/);
    expect(scrollbarStylesheet).toMatch(
      /\.feishu-viewer \.feishu-sidebar\s*\{[^}]*scrollbar-width:\s*thin;[^}]*scrollbar-color:\s*transparent transparent/,
    );
    expect(scrollbarStylesheet).toMatch(
      /\.feishu-viewer \.feishu-sidebar::-webkit-scrollbar\s*\{[^}]*width:\s*8px/,
    );
    expect(scrollbarStylesheet).toMatch(
      /\.feishu-viewer \.feishu-sidebar::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*transparent/,
    );
    expect(scrollbarStylesheet).toMatch(
      /\.feishu-viewer \.feishu-sidebar:hover,\s*\.feishu-viewer \.feishu-sidebar:focus-within\s*\{[^}]*scrollbar-color:\s*var\(--feishu-scrollbar-thumb\) var\(--feishu-scrollbar-track\)/,
    );
    expect(scrollbarStylesheet).not.toMatch(
      /\.feishu-viewer \.feishu-sidebar::-webkit-scrollbar[^}]*width:\s*0/,
    );
    expect(scrollbarStylesheet).not.toMatch(/\.feishu-viewer \.feishu-toc[^}]*scrollbar-width/);
  });
});
