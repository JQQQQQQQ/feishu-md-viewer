import { useState, useCallback, useRef, type ReactNode } from 'react';
import { MermaidEditor } from './MermaidEditor';
import { useViewerStore } from '../../store';

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
  const mode = useViewerStore((s) => s.mode);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleEdit = useCallback(() => {
    setIsEditorOpen(true);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
  }, []);

  const getSvgElement = useCallback((): SVGElement | null => {
    if (!containerRef.current) return null;
    return containerRef.current.querySelector('svg');
  }, []);

  const handleExportSvg = useCallback(() => {
    const svgEl = getSvgElement();
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, `mermaid-diagram-${blockIndex}.svg`);
  }, [getSvgElement, blockIndex]);

  const handleExportPng = useCallback(() => {
    const svgEl = getSvgElement();
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);

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
  }, [getSvgElement, blockIndex]);

  // Show export buttons always (read or edit mode), edit button only in edit mode
  return (
    <div className="mermaid-toolbar-wrapper" ref={containerRef}>
      <div className="mermaid-toolbar">
        {mode === 'edit' && (
          <button
            className="mermaid-toolbar__edit-btn"
            onClick={handleEdit}
            type="button"
            aria-label="Edit Mermaid diagram"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M10.5 1.75L12.25 3.5M1.75 12.25L2.333 9.917L10.083 2.167L11.833 3.917L4.083 11.667L1.75 12.25Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Edit
          </button>
        )}
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
      {isEditorOpen && (
        <MermaidEditor
          code={code}
          blockIndex={blockIndex}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  );
}
