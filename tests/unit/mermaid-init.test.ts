import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInitialize = vi.fn();
const mockRender = vi.fn().mockResolvedValue({ svg: '<svg>mock</svg>' });

vi.mock('mermaid', () => ({
  default: {
    initialize: mockInitialize,
    render: mockRender,
  },
}));

describe('mermaid-init', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInitialize.mockClear();
    mockRender.mockClear();
    mockRender.mockResolvedValue({ svg: '<svg>mock</svg>' });
  });

  it('initializes mermaid with strict security level on first render', async () => {
    const { renderMermaid } = await import('@/lib/mermaid-init');

    await renderMermaid('graph TD\n  A-->B', 'test-id');

    expect(mockInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: 'strict',
        startOnLoad: false,
      }),
    );
  });

  it('renders mermaid code to SVG', async () => {
    const { renderMermaid } = await import('@/lib/mermaid-init');

    const result = await renderMermaid('graph TD\n  A-->B', 'test-id');

    expect(result).toBe('<svg>mock</svg>');
  });
});
