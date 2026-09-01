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
    expect(darkStylesheet).toMatch(/--feishu-mermaid-edge-label-bg:\s*transparent;/i);
  });

  it('keeps flowchart edge label backgrounds transparent in light mode too', () => {
    expect(themeStylesheet).toMatch(/--feishu-mermaid-edge-label-bg:\s*transparent;/i);
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

  it('keeps Mermaid foreignObject and auxiliary labels readable in dark mode', () => {
    expect(markdownStylesheet).toContain('foreignObject *');
    expect(markdownStylesheet).toContain('color: var(--feishu-mermaid-node-text) !important;');
    expect(markdownStylesheet).toContain('fill: var(--feishu-mermaid-node-text) !important;');
    expect(markdownStylesheet).toContain('.mermaid-preview-zoom svg .edgeLabel');
    expect(markdownStylesheet).toContain('.mermaid-preview-zoom svg .sequenceNumber');
    expect(markdownStylesheet).toContain('.mermaid-preview-zoom svg .node path');
    expect(markdownStylesheet).toContain('.feishu-mermaid svg .node path');
    expect(markdownStylesheet).toContain('.mermaid-preview-zoom svg .nodeLabel text');
    expect(markdownStylesheet).toContain(
      '-webkit-text-fill-color: var(--feishu-mermaid-node-text) !important;',
    );
    expect(markdownStylesheet).toContain('.mermaid-preview-zoom svg .edgeLabel p');
    expect(markdownStylesheet).toContain(
      'background-color: var(--feishu-mermaid-edge-label-bg) !important;',
    );
    expect(mermaidStylesheet).toMatch(/\.mermaid-preview-canvas\s*\{[^}]*cursor:\s*grab;/i);
    expect(mermaidStylesheet).toContain('user-select: none;');
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

    const markerRule = markdownStylesheet.match(/\.feishu-mermaid svg marker path[^{}]*\{[^}]*\}/);
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
    expect(mermaidStylesheet).toMatch(/\.mermaid-toolbar-wrapper\s*\{[^}]*margin:\s*1\.25em 0;/i);
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

  it('uses a flat preview surface without a diagram frame and preserves dark contrast', () => {
    const canvasRules = [
      ...mermaidStylesheet.matchAll(/\.mermaid-preview-canvas\s*\{[^}]*\}/g),
    ].map(([rule]) => rule);
    const zoomRule = mermaidStylesheet.match(/\.mermaid-preview-zoom\s*\{[^}]*\}/);
    const darkZoomRule = mermaidStylesheet.match(
      /\.feishu-viewer--dark \.mermaid-preview-zoom\s*\{[^}]*\}/,
    );
    const darkToolbarRule = mermaidStylesheet.match(
      /\.feishu-viewer--dark \.mermaid-preview-toolbar\s*\{[^}]*\}/,
    );

    expect(canvasRules, 'expected a Mermaid preview canvas rule').not.toHaveLength(0);
    expect(canvasRules).toContainEqual(
      expect.stringContaining('background: var(--feishu-bg-page);'),
    );
    canvasRules.forEach((rule) => {
      expect(rule).not.toContain('background-image:');
      expect(rule).not.toContain('background-size:');
    });
    expect(zoomRule, 'expected a Mermaid preview surface rule').toBeTruthy();
    expect(zoomRule?.[0]).toContain('background: transparent;');
    expect(zoomRule?.[0]).toContain('border: 0;');
    expect(zoomRule?.[0]).toContain('box-shadow: none;');
    expect(darkZoomRule, 'expected a dark Mermaid preview surface rule').toBeTruthy();
    expect(darkZoomRule?.[0]).toContain('background: transparent;');
    expect(darkZoomRule?.[0]).toContain('border: 0;');
    expect(darkZoomRule?.[0]).toContain('box-shadow: none;');
    expect(darkToolbarRule, 'expected a dark Mermaid preview toolbar contrast rule').toBeTruthy();
    expect(darkToolbarRule?.[0]).toMatch(/border-color:\s*rgba\(255, 255, 255,/i);
    expect(darkToolbarRule?.[0]).toMatch(/box-shadow:\s*0 10px 28px rgba\(0, 0, 0,/i);
  });
});
