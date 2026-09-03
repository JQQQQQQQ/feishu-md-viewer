import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DotBlock } from '@/viewer/components/Markdown/DotBlock';
import { FeishuCodeBlock } from '@/viewer/components/Markdown/CodeBlock/CodeBlock';

const { mockRenderDot } = vi.hoisted(() => ({ mockRenderDot: vi.fn() }));

vi.mock('@/lib/dot-init', () => ({
  renderDot: mockRenderDot,
}));

describe('DotBlock', () => {
  beforeEach(() => {
    mockRenderDot.mockResolvedValue('<svg viewBox="0 0 100 40"><text>DOT</text></svg>');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each(['dot', 'graphviz', 'gv'])('语言 %s 渲染为 DOT 图表', async (language) => {
    const view = render(
      <FeishuCodeBlock>
        <code className={`language-${language}`}>{'digraph G {}'}</code>
      </FeishuCodeBlock>,
    );

    expect(await screen.findByText('DOT')).toBeTruthy();
    expect(view.container.querySelector('.feishu-dot')).toBeTruthy();
    expect(mockRenderDot).toHaveBeenCalledWith('digraph G {}');
  });

  it('DOT 失败时保留源码并显示错误', async () => {
    mockRenderDot.mockRejectedValueOnce(new Error('syntax error'));

    const view = render(<DotBlock code="digraph {" index={0} />);

    expect(await screen.findByText('DOT 渲染失败')).toBeTruthy();
    expect(view.container.querySelector('pre')?.textContent).toContain('digraph {');
  });
});
