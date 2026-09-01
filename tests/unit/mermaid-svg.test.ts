import { describe, expect, it } from 'vitest';
import { expandMermaidSvgBounds } from '@/viewer/utils/mermaid-svg';
import { sanitizeMermaidSvg } from '@/viewer/utils/sanitize-svg';

describe('expandMermaidSvgBounds', () => {
  it('expands the root SVG viewport and numeric dimensions', () => {
    const result = expandMermaidSvgBounds(
      '<svg width="100" height="50" viewBox="0 0 100 50"><g><text>Start</text></g></svg>',
    );

    expect(result).toContain('width="184"');
    expect(result).toContain('height="78"');
    expect(result).toContain('viewBox="-42 -14 184 78"');
  });

  it('removes clipping and text length constraints that can crop labels', () => {
    const result = expandMermaidSvgBounds(
      '<svg viewBox="0 0 100 50"><g clip-path="url(#clip)"><text textLength="24" lengthAdjust="spacing">Debug</text></g></svg>',
    );

    expect(result).not.toContain('clip-path');
    expect(result).not.toContain('textLength');
    expect(result).not.toContain('lengthAdjust');
    expect(result).toContain('overflow: visible');
  });

  it('expands foreignObject labels symmetrically', () => {
    const result = expandMermaidSvgBounds(
      '<svg viewBox="0 0 100 50"><foreignObject x="10" y="12" width="40" height="20"><div><p>Is it working?</p></div></foreignObject></svg>',
    );

    expect(result).toContain('x="-12"');
    expect(result).toContain('width="84"');
    expect(result).toContain('y="4"');
    expect(result).toContain('height="36"');
    expect(result).toContain('margin: 0; line-height: 1.2');
  });

  it('keeps invalid SVG unchanged', () => {
    const input = '<div>not svg</div>';

    expect(expandMermaidSvgBounds(input)).toBe(input);
  });
});

describe('sanitizeMermaidSvg', () => {
  it('can sanitize an already-expanded diagram without expanding its geometry again', () => {
    const alreadyExpanded = '<svg width="184" height="78" viewBox="-42 -14 184 78"><path d="M0 0 L100 50" /></svg>';

    const result = sanitizeMermaidSvg(alreadyExpanded, { expandBounds: false });

    expect(result).toContain('width="184"');
    expect(result).toContain('height="78"');
    expect(result).toContain('viewBox="-42 -14 184 78"');
  });

  it('removes executable SVG content after expanding bounds', () => {
    const result = sanitizeMermaidSvg(
      '<svg width="100" height="50" viewBox="0 0 100 50" onload="alert(1)"><script>alert(1)</script><text>Start</text></svg>',
    );

    expect(result).toContain('<svg');
    expect(result).toContain('viewBox="-42 -14 184 78"');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('onload');
  });

  it('preserves foreignObject label text content', () => {
    const result = sanitizeMermaidSvg(
      '<svg viewBox="0 0 120 60"><foreignObject x="10" y="10" width="100" height="40"><div xmlns="http://www.w3.org/1999/xhtml"><p>中文标签</p></div></foreignObject></svg>',
    );

    expect(result).toContain('foreignObject');
    expect(result).toContain('中文标签');
  });

  it('preserves nested div/span node labels in foreignObject', () => {
    const result = sanitizeMermaidSvg(
      '<svg viewBox="0 0 140 60"><foreignObject x="10" y="10" width="120" height="40"><div xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">Start</span></div></foreignObject></svg>',
    );

    expect(result).toContain('foreignObject');
    expect(result).toContain('nodeLabel');
    expect(result).toContain('Start');
  });

  it('restores xhtml namespace for foreignObject html nodes', () => {
    const result = sanitizeMermaidSvg(
      '<svg viewBox="0 0 140 60"><foreignObject x="10" y="10" width="120" height="40"><div><span class="nodeLabel">Debug</span></div></foreignObject></svg>',
    );

    expect(result).toContain('xmlns="http://www.w3.org/1999/xhtml"');
    expect(result).toContain('Debug');
  });

  it('pins node label text to the viewer theme inside Mermaid foreignObject output', () => {
    const result = sanitizeMermaidSvg(
      '<svg viewBox="0 0 140 60"><g class="node"><foreignObject x="10" y="10" width="120" height="40"><div><span class="nodeLabel"><p>有效图表</p></span></div></foreignObject></g></svg>',
    );

    expect(result).toContain('color: var(--feishu-mermaid-node-text) !important');
    expect(result).toContain('fill: var(--feishu-mermaid-node-text) !important');
  });

  it('pins sequence actor tspan labels to the viewer theme', () => {
    const result = sanitizeMermaidSvg(
      '<svg viewBox="0 0 320 180"><text class="actor actor-box" x="80" y="30"><tspan x="80" dy="0" style="overflow: visible">相邻图表</tspan></text></svg>',
      { expandBounds: false },
    );

    expect(result).toContain(
      '<tspan x="80" dy="0" style="overflow: visible; color: var(--feishu-mermaid-node-text) !important; fill: var(--feishu-mermaid-node-text) !important;',
    );
  });
});
