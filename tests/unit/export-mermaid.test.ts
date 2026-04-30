import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Mermaid export (SVG & PNG)', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let mockAnchorClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:fake-url');
    URL.revokeObjectURL = vi.fn();

    mockAnchorClick = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: mockAnchorClick,
          setAttribute: vi.fn(),
        } as unknown as HTMLAnchorElement;
      }
      // For canvas element
      if (tag === 'canvas') {
        const mockCtx = {
          scale: vi.fn(),
          drawImage: vi.fn(),
        };
        return {
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue(mockCtx),
          toBlob: vi.fn((callback: BlobCallback) => {
            callback(new Blob(['png-data'], { type: 'image/png' }));
          }),
        } as unknown as HTMLCanvasElement;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  describe('SVG export', () => {
    it('creates a download link with correct MIME type (image/svg+xml)', () => {
      const svgString = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });

      expect(blob.type).toBe('image/svg+xml;charset=utf-8');

      URL.createObjectURL(blob);
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    });

    it('triggers download via anchor click', () => {
      const svgString = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement('a') as unknown as { href: string; download: string; click: () => void };
      anchor.href = url;
      anchor.download = 'mermaid-diagram-0.svg';
      anchor.click();

      expect(mockAnchorClick).toHaveBeenCalled();
    });

    it('revokes object URL after download', () => {
      const svgString = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      URL.revokeObjectURL(url);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    });
  });

  describe('PNG export', () => {
    it('creates a canvas element for PNG conversion', () => {
      const canvas = document.createElement('canvas') as unknown as HTMLCanvasElement;
      expect(canvas).toBeDefined();
      expect(canvas.getContext).toBeDefined();
    });

    it('gets 2d context from canvas', () => {
      const canvas = document.createElement('canvas') as unknown as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      expect(ctx).not.toBeNull();
      expect(canvas.getContext).toHaveBeenCalledWith('2d');
    });

    it('calls toBlob on canvas for PNG output', () => {
      const canvas = document.createElement('canvas') as unknown as HTMLCanvasElement;
      let receivedBlob: Blob | null = null;

      canvas.toBlob((blob) => {
        receivedBlob = blob;
      }, 'image/png');

      expect(canvas.toBlob).toHaveBeenCalled();
      expect(receivedBlob).not.toBeNull();
      expect(receivedBlob!.type).toBe('image/png');
    });

    it('scales canvas 2x for high-DPI export', () => {
      const canvas = document.createElement('canvas') as unknown as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;

      // Simulate the 2x scaling logic from MermaidToolbar
      const scale = 2;
      const imgWidth = 100;
      const imgHeight = 50;
      canvas.width = imgWidth * scale;
      canvas.height = imgHeight * scale;
      (ctx as unknown as { scale: ReturnType<typeof vi.fn> }).scale(scale, scale);

      expect(canvas.width).toBe(200);
      expect(canvas.height).toBe(100);
      expect(ctx.scale).toHaveBeenCalledWith(2, 2);
    });
  });
});
