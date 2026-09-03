import { describe, expect, it } from 'vitest';
import { sanitizeDotSvg } from '@/viewer/utils/sanitize-dot-svg';

describe('sanitizeDotSvg', () => {
  it('保留 Graphviz 节点、边和文字', () => {
    const svg = '<svg viewBox="0 0 100 100"><g class="node"><title>A</title><ellipse cx="20" cy="20" rx="10" ry="8" /><text>A</text></g><path d="M0 0" /></svg>';

    const result = sanitizeDotSvg(svg);

    expect(result).toContain('<text>A</text>');
    expect(result).toContain('<ellipse');
    expect(result).toContain('<path');
  });

  it('移除脚本、事件属性和 javascript 链接', () => {
    const svg = '<svg><script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)"><text>X</text></a></svg>';

    const result = sanitizeDotSvg(svg);

    expect(result).not.toMatch(/script|onclick|javascript:/i);
    expect(result).toContain('<text>X</text>');
  });

  it('非 SVG 输入返回空字符串', () => {
    expect(sanitizeDotSvg('<div>not svg</div>')).toBe('');
  });

  it('接受 Graphviz 常见的 XML 声明和 DOCTYPE 前缀', () => {
    const svg = '<?xml version="1.0"?><!DOCTYPE svg><svg><text>Graphviz</text></svg>';

    expect(sanitizeDotSvg(svg)).toContain('<text>Graphviz</text>');
  });
});
