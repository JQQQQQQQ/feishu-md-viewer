import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const markdownStylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/markdown.css'),
  'utf8',
).replace(/\s+/g, ' ');
const themeStylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/feishu-theme.css'),
  'utf8',
).replace(/\s+/g, ' ');
const darkStylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/dark-theme.css'),
  'utf8',
).replace(/\s+/g, ' ');
const mermaidStylesheet = readFileSync(
  resolve(__dirname, '../../src/viewer/styles/mermaid.css'),
  'utf8',
).replace(/\s+/g, ' ');

describe('Mermaid modern visual theme', () => {
  it('defines dedicated light and dark Mermaid tokens', () => {
    expect(themeStylesheet).toMatch(/--feishu-mermaid-node-bg:\s*#eef4ff;/i);
    expect(themeStylesheet).toMatch(/--feishu-mermaid-node-border:\s*#8fb1ff;/i);
    expect(darkStylesheet).toMatch(/--feishu-mermaid-node-bg:\s*#243b66;/i);
    expect(darkStylesheet).toMatch(/--feishu-mermaid-edge:\s*#8eabff;/i);
    expect(darkStylesheet).toMatch(/--feishu-mermaid-node-text:\s*#f2f5ff;/i);
  });

  it('uses a quieter diagram card with explicit SVG node and edge styling', () => {
    expect(markdownStylesheet).toMatch(
      /\.feishu-mermaid\s*\{[^}]*padding:\s*44px 20px 20px;[^}]*background-color:\s*var\(--feishu-bg-content\);/i,
    );
    expect(markdownStylesheet).toContain('fill: var(--feishu-mermaid-node-bg) !important;');
    expect(markdownStylesheet).toContain('stroke: var(--feishu-mermaid-node-border) !important;');
    expect(markdownStylesheet).toContain('stroke: var(--feishu-mermaid-edge) !important;');
    expect(markdownStylesheet).toContain('fill: var(--feishu-mermaid-node-text) !important;');
    expect(markdownStylesheet).toContain('.mermaid-preview-zoom svg .node rect');
    expect(markdownStylesheet).toContain('.mermaid-preview-zoom svg .edgePath .path');
    expect(markdownStylesheet).toContain('.mermaid-preview-zoom svg rect.actor');
  });

  it('keeps Mermaid edge strokes thin and prevents fill on connection lines', () => {
    // The CSS must paint only stroke (not fill) on the line itself. Painting
    // fill onto an open path turns the line into a thick filled band in the
    // VS Code Webview. Markers still need fill so the arrowhead renders.
    const lineRule = markdownStylesheet.match(
      /\.feishu-mermaid svg \.flowchart-link[^{}]*\{[^}]*\}/,
    );
    expect(lineRule, 'expected a .feishu-mermaid svg .flowchart-link rule').toBeTruthy();
    expect(lineRule?.[0]).toContain('fill: none !important;');
    expect(lineRule?.[0]).toContain('stroke: var(--feishu-mermaid-edge) !important;');
    expect(lineRule?.[0]).toMatch(/stroke-width:\s*[0-9.]+px/);

    const markerRule = markdownStylesheet.match(
      /\.feishu-mermaid svg marker path[^{}]*\{[^}]*\}/,
    );
    expect(markerRule, 'expected a marker path rule').toBeTruthy();
    expect(markerRule?.[0]).toContain('fill: var(--feishu-mermaid-edge) !important;');
    expect(markerRule?.[0]).toContain('stroke: var(--feishu-mermaid-edge) !important;');

    // Mermaid 11 ships markerWidth=8 with markerUnits=userSpaceOnUse; cap it.
    expect(markdownStylesheet).toContain('marker-width: 6;');
    expect(markdownStylesheet).toContain('marker-height: 6;');
  });

  it('keeps Mermaid toolbar surfaces quiet and consistent with the diagram card', () => {
    expect(mermaidStylesheet).toMatch(
      /\.mermaid-toolbar\s*\{[^}]*background-color:\s*color-mix\(in srgb, var\(--feishu-bg-content\) 92%, transparent\);/i,
    );
    expect(mermaidStylesheet).toMatch(
      /\.mermaid-toolbar-wrapper\s*\{[^}]*margin:\s*1\.25em 0;/i,
    );
    expect(mermaidStylesheet).toContain('background: var(--feishu-bg-content);');
    expect(mermaidStylesheet).toContain('border: 1px solid var(--feishu-border-lighter);');
    expect(mermaidStylesheet).toContain('transform-origin: center center;');
    expect(mermaidStylesheet).toContain('min-height: 0;');
    expect(mermaidStylesheet).toContain('overscroll-behavior: contain;');
    expect(markdownStylesheet).toContain('.feishu-mermaid__diagram');
    expect(markdownStylesheet).toContain('.mermaid-preview-zoom');
    expect(markdownStylesheet).toContain('justify-content: center;');
    expect(mermaidStylesheet).toContain('align-items: center;');
    expect(mermaidStylesheet).toContain('justify-content: center;');
  });
});
