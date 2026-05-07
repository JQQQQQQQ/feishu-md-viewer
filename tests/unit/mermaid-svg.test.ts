import { describe, expect, it } from 'vitest';
import { expandMermaidSvgBounds } from '@/viewer/utils/mermaid-svg';

describe('expandMermaidSvgBounds', () => {
  it('expands the root SVG viewport and numeric dimensions', () => {
    const result = expandMermaidSvgBounds(
      '<svg width="100" height="50" viewBox="0 0 100 50"><g><text>Start</text></g></svg>',
    );

    expect(result).toContain('width="160"');
    expect(result).toContain('height="74"');
    expect(result).toContain('viewBox="-30 -12 160 74"');
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

    expect(result).toContain('x="-6"');
    expect(result).toContain('width="72"');
    expect(result).toContain('y="4"');
    expect(result).toContain('height="36"');
    expect(result).toContain('margin: 0; line-height: 1.2');
  });

  it('keeps invalid SVG unchanged', () => {
    const input = '<div>not svg</div>';

    expect(expandMermaidSvgBounds(input)).toBe(input);
  });
});
