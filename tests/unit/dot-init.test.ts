import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRenderString = vi.fn();
const mockInstance = vi.fn().mockResolvedValue({ renderString: mockRenderString });

vi.mock('@viz-js/viz', () => ({ instance: mockInstance }));

describe('dot-init', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInstance.mockClear();
    mockRenderString.mockReset();
  });

  it('使用 dot 引擎把源码渲染成 SVG', async () => {
    mockRenderString.mockReturnValue('<svg><g id="graph0" /></svg>');
    const { renderDot } = await import('@/lib/dot-init');

    await expect(renderDot('digraph G { A -> B; }')).resolves.toContain('<svg>');
    expect(mockInstance).toHaveBeenCalledTimes(1);
    expect(mockRenderString).toHaveBeenCalledWith('digraph G { A -> B; }', {
      format: 'svg',
      engine: 'dot',
    });
  });

  it('相同源码命中缓存，不重复初始化和渲染', async () => {
    mockRenderString.mockReturnValue('<svg />');
    const { renderDot } = await import('@/lib/dot-init');

    await renderDot('graph G { A -- B; }');
    await renderDot('graph G { A -- B; }');

    expect(mockInstance).toHaveBeenCalledTimes(1);
    expect(mockRenderString).toHaveBeenCalledTimes(1);
  });

  it('渲染失败时抛出用户可读错误', async () => {
    mockRenderString.mockImplementation(() => {
      throw new Error('syntax error');
    });
    const { renderDot } = await import('@/lib/dot-init');

    await expect(renderDot('digraph { A -> ; }')).rejects.toThrow('syntax error');
  });
});
