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

  it('保留 Graphviz 根 SVG 的宽高，避免复杂图表退回默认尺寸', () => {
    const svg = '<svg width="143pt" height="416pt" viewBox="0 0 143 416"><text>Graphviz</text></svg>';

    expect(sanitizeDotSvg(svg)).toMatch(/width="143pt"/);
    expect(sanitizeDotSvg(svg)).toMatch(/height="416pt"/);
  });

  it('保留 Graphviz 节点和连线所需的 points 与 d 几何属性', () => {
    const svg = '<svg viewBox="0 0 100 100"><polygon points="0,0 10,0 10,10" /><path d="M0 0 L10 10" /></svg>';
    const result = sanitizeDotSvg(svg);

    expect(result).toMatch(/points="0,0 10,0 10,10"/);
    expect(result).toMatch(/d="M0 0 L10 10"/);
  });

  it('保留 Graphviz 坐标系转换，避免内容被视口裁掉', () => {
    const svg = '<svg viewBox="0 0 100 100"><g transform="scale(1 1) rotate(0) translate(4 40)"><path d="M0 0 L10 10" /></g></svg>';
    const result = sanitizeDotSvg(svg);

    expect(result).toMatch(/transform="scale\(1 1\) rotate\(0\) translate\(4 40\)"/);
  });
});
