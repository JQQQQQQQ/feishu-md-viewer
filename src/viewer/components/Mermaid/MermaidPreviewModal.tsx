import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

interface MermaidPreviewModalProps {
  svg: string;
  onClose: () => void;
}
interface SvgSize {
  width: number;
  height: number;
}
interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
}
const DEFAULT_PREVIEW_SIZE: SvgSize = { width: 800, height: 500 };
const FIT_PADDING = 80;
const FIT_MAX_ZOOM = 2.5;
const ZOOM_BUTTON_FACTOR = 1.2;

function clampZoom(value: number): number {
  return Math.min(4, Math.max(0.25, value));
}

function getWheelZoomStep(deltaY: number): number {
  const direction = deltaY > 0 ? -1 : 1;
  return direction * Math.min(0.03, Math.max(0.008, Math.abs(deltaY) / 24000));
}

function parseSvgLength(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(\d+(?:\.\d+)?)(px)?$/);
  return match?.[1] ? Number(match[1]) : null;
}

function getSvgPreviewSize(svgString: string): SvgSize {
  if (typeof DOMParser === 'undefined') return DEFAULT_PREVIEW_SIZE;

  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.tagName.toLowerCase() !== 'svg') return DEFAULT_PREVIEW_SIZE;

  const width = parseSvgLength(svg.getAttribute('width'));
  const height = parseSvgLength(svg.getAttribute('height'));
  if (width !== null && height !== null) return { width, height };

  const viewBox = svg.getAttribute('viewBox');
  const parts = viewBox?.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  if (parts?.length === 4) {
    const [, , viewBoxWidth, viewBoxHeight] = parts as [number, number, number, number];
    return { width: viewBoxWidth, height: viewBoxHeight };
  }

  return DEFAULT_PREVIEW_SIZE;
}

function centerCanvas(canvas: HTMLDivElement): void {
  canvas.scrollLeft = Math.max(0, (canvas.scrollWidth - canvas.clientWidth) / 2);
  canvas.scrollTop = Math.max(0, (canvas.scrollHeight - canvas.clientHeight) / 2);
}

function getFitZoom(canvas: HTMLDivElement, size: SvgSize): number {
  const availableWidth = Math.max(1, canvas.clientWidth - FIT_PADDING);
  const availableHeight = Math.max(1, canvas.clientHeight - FIT_PADDING);
  return clampZoom(Math.min(FIT_MAX_ZOOM, availableWidth / size.width, availableHeight / size.height));
}

export function MermaidPreviewModal({ svg, onClose }: MermaidPreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const previewSize = useMemo(() => getSvgPreviewSize(svg), [svg]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const setZoomFromCenter = useCallback((nextZoom: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setZoom(nextZoom);
      return;
    }

    const centerX = canvas.clientWidth / 2;
    const centerY = canvas.clientHeight / 2;
    const scrollX = canvas.scrollLeft + centerX;
    const scrollY = canvas.scrollTop + centerY;

    setZoom((current) => {
      const next = clampZoom(Number(nextZoom.toFixed(3)));
      const zoomRatio = next / current;

      requestAnimationFrame(() => {
        canvas.scrollLeft = scrollX * zoomRatio - centerX;
        canvas.scrollTop = scrollY * zoomRatio - centerY;
      });

      return next;
    });
  }, []);

  const fitToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setZoom(Number(getFitZoom(canvas, previewSize).toFixed(3)));
    requestAnimationFrame(() => centerCanvas(canvas));
  }, [previewSize]);

  const resetToActualSize = useCallback(() => {
    setZoom(1);
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (canvas) centerCanvas(canvas);
    });
  }, []);

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const scrollX = canvas.scrollLeft + mouseX;
    const scrollY = canvas.scrollTop + mouseY;

    setZoom((current) => {
      const next = clampZoom(Number((current + getWheelZoomStep(event.deltaY)).toFixed(3)));
      const zoomRatio = next / current;

      requestAnimationFrame(() => {
        canvas.scrollLeft = scrollX * zoomRatio - mouseX;
        canvas.scrollTop = scrollY * zoomRatio - mouseY;
      });

      return next;
    });
  }, []);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop,
    };
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const canvas = canvasRef.current;
    if (!dragState || !canvas || event.pointerId !== dragState.pointerId) return;

    canvas.scrollLeft = dragState.scrollLeft - (event.clientX - dragState.startX);
    canvas.scrollTop = dragState.scrollTop - (event.clientY - dragState.startY);
  }, []);

  const stopDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const canvas = canvasRef.current;
    if (!dragState || !canvas || event.pointerId !== dragState.pointerId) return;

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      fitToCanvas();
    });

    return () => cancelAnimationFrame(frameId);
  }, [fitToCanvas, svg]);

  return (
    <div
      className="mermaid-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Mermaid diagram preview"
      onMouseDown={onClose}
    >
      <div
        className="mermaid-preview-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mermaid-preview-toolbar">
          <span className="mermaid-preview-toolbar__title">Mermaid 预览</span>
          <div className="mermaid-preview-toolbar__actions" aria-label="Mermaid preview controls">
            <button
              className="mermaid-preview-toolbar__button"
              type="button"
              aria-label="Fit Mermaid preview to window"
              onClick={fitToCanvas}
            >
              适应
            </button>
            <button
              className="mermaid-preview-toolbar__button"
              type="button"
              aria-label="Reset Mermaid preview to actual size"
              onClick={resetToActualSize}
            >
              100%
            </button>
            <button
              className="mermaid-preview-toolbar__icon-button"
              type="button"
              aria-label="Zoom out Mermaid preview"
              onClick={() => setZoomFromCenter(zoom / ZOOM_BUTTON_FACTOR)}
            >
              -
            </button>
            <button
              className="mermaid-preview-toolbar__icon-button"
              type="button"
              aria-label="Zoom in Mermaid preview"
              onClick={() => setZoomFromCenter(zoom * ZOOM_BUTTON_FACTOR)}
            >
              +
            </button>
          </div>
          <span className="mermaid-preview-toolbar__zoom">
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="mermaid-preview-toolbar__close"
            type="button"
            aria-label="Close Mermaid preview"
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div
          className={`mermaid-preview-canvas${isDragging ? ' mermaid-preview-canvas--dragging' : ''}`}
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <div
            className="mermaid-preview-content"
            style={{
              width: `max(100%, ${previewSize.width * zoom}px)`,
              height: `max(100%, ${previewSize.height * zoom}px)`,
            }}
          >
            <div
              className="mermaid-preview-zoom"
              style={{
                width: `${previewSize.width}px`,
                height: `${previewSize.height}px`,
                transform: `scale(${zoom})`,
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
