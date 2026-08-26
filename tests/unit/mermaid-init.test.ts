import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInitialize = vi.fn();
const mockParse = vi.fn().mockResolvedValue(true);
const mockRender = vi.fn().mockResolvedValue({ svg: '<svg>mock</svg>' });

vi.mock('mermaid', () => ({
  default: {
    initialize: mockInitialize,
    parse: mockParse,
    render: mockRender,
  },
}));

describe('mermaid-init', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInitialize.mockClear();
    mockParse.mockClear();
    mockRender.mockClear();
    mockParse.mockResolvedValue(true);
    mockRender.mockResolvedValue({ svg: '<svg>mock</svg>' });
  });

  it('initializes mermaid with strict security level on first render', async () => {
    const { renderMermaid } = await import('@/lib/mermaid-init');

    await renderMermaid('graph TD\n  A-->B', 'test-id');

    expect(mockInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: 'strict',
        startOnLoad: false,
        htmlLabels: true,
        theme: 'base',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 14,
        themeVariables: expect.objectContaining({
          primaryColor: '#eef4ff',
          primaryBorderColor: '#8fb1ff',
          primaryTextColor: '#1f2329',
          lineColor: '#5b7cff',
        }),
        flowchart: expect.objectContaining({
          curve: 'basis',
          padding: 24,
        }),
      }),
    );
  });

  it('renders mermaid code to SVG', async () => {
    const { renderMermaid } = await import('@/lib/mermaid-init');

    const result = await renderMermaid('graph TD\n  A-->B', 'test-id');

    expect(result).toBe('<svg>mock</svg>');
  });

  it('reuses cached svg for same code and skips repeated parse/render', async () => {
    const { renderMermaid } = await import('@/lib/mermaid-init');
    const code = 'graph TD\n  A-->B';

    const first = await renderMermaid(code, 'cache-id-1');
    const second = await renderMermaid(code, 'cache-id-2');

    expect(first).toBe('<svg>mock</svg>');
    expect(second).toBe('<svg>mock</svg>');
    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(mockRender).toHaveBeenCalledTimes(1);
  });

  it('keeps recently used entry and evicts true LRU entry when cache is full', async () => {
    const { renderMermaid } = await import('@/lib/mermaid-init');
    const warmCode = 'graph TD\n  WARM-->NODE';

    await renderMermaid(warmCode, 'warm-1');
    for (let i = 0; i < 23; i += 1) {
      await renderMermaid(`graph TD\n  N${i}-->N${i + 1}`, `fill-${i}`);
    }

    await renderMermaid(warmCode, 'warm-2');
    expect(mockRender).toHaveBeenCalledTimes(24);

    await renderMermaid('graph TD\n  EVICT-->NEW', 'evict-new');
    await renderMermaid(warmCode, 'warm-3');

    expect(mockRender).toHaveBeenCalledTimes(25);
  });
});
