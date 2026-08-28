import { useState, useCallback, useRef, type ReactNode } from 'react';
import { MermaidPreviewModal } from './MermaidPreviewModal';

interface MermaidToolbarProps {
  code: string;
  blockIndex: number;
  children: ReactNode;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function MermaidToolbar({ code, blockIndex, children }: MermaidToolbarProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewButtonRef = useRef<HTMLButtonElement>(null);

  const getSvgElement = useCallback((): SVGElement | null => {
    if (!containerRef.current) return null;
    return containerRef.current.querySelector('.feishu-mermaid svg');
  }, []);

  const getSerializedSvg = useCallback((): string | null => {
    const svgEl = getSvgElement();
    if (!svgEl) return null;

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgEl);
  }, [getSvgElement]);

  const handleOpenPreview = useCallback(() => {
    const svgString = getSerializedSvg();
    if (!svgString) return;

    setPreviewSvg(svgString);
    setIsPreviewOpen(true);
  }, [getSerializedSvg]);

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    requestAnimationFrame(() => previewButtonRef.current?.focus());
  }, []);

  const handleExportSvg = useCallback(() => {
    const svgString = getSerializedSvg();
    if (!svgString) return;

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, `mermaid-diagram-${blockIndex}.svg`);
  }, [getSerializedSvg, blockIndex]);

  const handleCopySource = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(code);
    } catch {
      // Clipboard API may be unavailable in restricted extension contexts.
    }
  }, [code]);

  const handleExportPng = useCallback(() => {
    const svgString = getSerializedSvg();
    if (!svgString) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const scale = 2; // 2x for high-DPI
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, `mermaid-diagram-${blockIndex}.png`);
        }
      }, 'image/png');
    };

    img.src = url;
  }, [getSerializedSvg, blockIndex]);

  // 预览版保留图表查看、复制和导出操作，不提供源码编辑入口。
  return (
    <div className="mermaid-toolbar-wrapper" ref={containerRef} data-mermaid-block-index={blockIndex}>
      <div className="mermaid-toolbar">
        <button
          ref={previewButtonRef}
          className="mermaid-toolbar__preview-btn"
          onClick={handleOpenPreview}
          type="button"
          aria-label="Preview Mermaid diagram"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1.75 7s1.9-3.5 5.25-3.5S12.25 7 12.25 7 10.35 10.5 7 10.5 1.75 7 1.75 7Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="7" cy="7" r="1.45" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          预览
        </button>
        <button
          className="mermaid-toolbar__export-btn"
          onClick={() => { void handleCopySource(); }}
          type="button"
          aria-label="Copy Mermaid source"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M4.5 4.5h6v6h-6zM3.5 9.5h-1v-7h7v1" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          源码
        </button>
        <button
          className="mermaid-toolbar__export-btn"
          onClick={handleExportSvg}
          type="button"
          aria-label="Export diagram as SVG"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 2v7M4 6.5L7 9.5l3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 11h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          SVG
        </button>
        <button
          className="mermaid-toolbar__export-btn"
          onClick={handleExportPng}
          type="button"
          aria-label="Export diagram as PNG"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 2v7M4 6.5L7 9.5l3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 11h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          PNG
        </button>
      </div>
      {children}
      {isPreviewOpen && previewSvg && (
        <MermaidPreviewModal svg={previewSvg} onClose={handleClosePreview} />
      )}
    </div>
  );
}
