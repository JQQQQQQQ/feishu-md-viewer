import { useCallback, useRef, useState, type ReactNode } from 'react';
import { DiagramPreviewModal } from './DiagramPreviewModal';

export type DiagramKind = 'DOT' | 'Mermaid';

interface DiagramToolbarProps {
  code: string;
  blockIndex: number;
  kind: DiagramKind;
  svgSelector: string;
  sanitizeSvg?: (svg: string) => string;
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

export function DiagramToolbar({
  code,
  blockIndex,
  kind,
  svgSelector,
  sanitizeSvg = (svg) => svg,
  children,
}: DiagramToolbarProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const label = `${kind} 图表`;
  const filePrefix = `${kind.toLowerCase()}-diagram-${blockIndex}`;

  const getSvgElement = useCallback((): SVGElement | null => {
    return containerRef.current?.querySelector<SVGElement>(svgSelector) ?? null;
  }, [svgSelector]);

  const getSerializedSvg = useCallback((): string | null => {
    const svgElement = getSvgElement();
    return svgElement ? new XMLSerializer().serializeToString(svgElement) : null;
  }, [getSvgElement]);

  const handleOpenPreview = useCallback(() => {
    const svg = getSerializedSvg();
    if (!svg) return;
    setPreviewSvg(svg);
    setIsPreviewOpen(true);
  }, [getSerializedSvg]);

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    requestAnimationFrame(() => previewButtonRef.current?.focus());
  }, []);

  const handleCopySource = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(code);
    } catch {
      // Clipboard API may not be available in restricted extension contexts.
    }
  }, [code]);

  const handleExportSvg = useCallback(() => {
    const svg = getSerializedSvg();
    if (!svg) return;
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${filePrefix}.svg`);
  }, [filePrefix, getSerializedSvg]);

  const handleExportPng = useCallback(() => {
    const svg = getSerializedSvg();
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    const image = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    image.onload = () => {
      const scale = 2;
      canvas.width = image.naturalWidth * scale;
      canvas.height = image.naturalHeight * scale;
      context.scale(scale, scale);
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `${filePrefix}.png`);
      }, 'image/png');
    };
    image.src = url;
  }, [filePrefix, getSerializedSvg]);

  return (
    <div
      className={`diagram-toolbar-wrapper diagram-toolbar-wrapper--${kind.toLowerCase()}`}
      ref={containerRef}
      data-diagram-kind={kind}
      data-diagram-block-index={blockIndex}
    >
      <div className="diagram-toolbar">
        <button
          ref={previewButtonRef}
          className="diagram-toolbar__preview-btn"
          onClick={handleOpenPreview}
          type="button"
          aria-label={`预览 ${label}`}
        >
          预览
        </button>
        <button
          className="diagram-toolbar__export-btn"
          onClick={() => { void handleCopySource(); }}
          type="button"
          aria-label={`复制 ${kind} 源码`}
        >
          源码
        </button>
        <button
          className="diagram-toolbar__export-btn"
          onClick={handleExportSvg}
          type="button"
          aria-label={`导出 ${kind} 图表为 SVG`}
        >
          SVG
        </button>
        <button
          className="diagram-toolbar__export-btn"
          onClick={handleExportPng}
          type="button"
          aria-label={`导出 ${kind} 图表为 PNG`}
        >
          PNG
        </button>
      </div>
      {children}
      {isPreviewOpen && previewSvg && (
        <DiagramPreviewModal
          svg={previewSvg}
          title={`${kind} 图表预览`}
          onClose={handleClosePreview}
          sanitizeSvg={sanitizeSvg}
        />
      )}
    </div>
  );
}
