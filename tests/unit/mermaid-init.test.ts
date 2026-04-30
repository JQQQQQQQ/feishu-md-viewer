import { describe, it, expect, vi } from 'vitest';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg>mock</svg>' }),
  },
}));

describe('mermaid-init', () => {
  it('initializes mermaid with strict security level', async () => {
    const mermaid = await import('mermaid');
    const { initMermaid } = await import('@/lib/mermaid-init');

    initMermaid();

    expect(mermaid.default.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: 'strict',
        startOnLoad: false,
      }),
    );
  });

  it('renders mermaid code to SVG', async () => {
    const { renderMermaid } = await import('@/lib/mermaid-init');
    const result = await renderMermaid('graph TD\n  A-->B', 'test-id');
    expect(result).toContain('<svg>');
  });
});
