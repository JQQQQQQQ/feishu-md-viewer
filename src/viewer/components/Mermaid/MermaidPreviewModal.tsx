import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { sanitizeMermaidSvg } from '../../utils/sanitize-svg';

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
  const [toolbarVisible, setToolbarVisible] = useState(false);
  // The source SVG comes from the already-rendered MermaidBlock. It has
  // already had its bounds expanded once; expanding it again shifts the
  // viewBox and makes preview edges/nodes appear offset from the document.
  const safeSvg = useMemo(() => sanitizeMermaidSvg(svg, { expandBounds: false }), [svg]);
  const previewSize = useMemo(() => getSvgPreviewSize(safeSvg), [safeSvg]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const toolbarHideTimerRef = useRef<number | null>(null);
  const toolbarHasFocusRef = useRef(false);
  const applyingInitialToolbarFocusRef = useRef(false);
  const pointerOverToolbarRef = useRef(false);
  const pointerOverHitAreaRef = useRef(false);

  const clearToolbarHideTimer = useCallback(() => {
    if (toolbarHideTimerRef.current !== null) {
      window.clearTimeout(toolbarHideTimerRef.current);
      toolbarHideTimerRef.current = null;
    }
  }, []);

  const toolbarHasFocus = useCallback(() => toolbarHasFocusRef.current, []);

  const showToolbar = useCallback((_reason?: 'pointer' | 'keyboard' | 'focus') => {
    clearToolbarHideTimer();
    setToolbarVisible(true);
  }, [clearToolbarHideTimer]);

  const scheduleToolbarHide = useCallback(() => {
    clearToolbarHideTimer();
    if (toolbarHasFocus() || pointerOverToolbarRef.current || pointerOverHitAreaRef.current) {
      return;
    }
    toolbarHideTimerRef.current = window.setTimeout(() => {
      toolbarHideTimerRef.current = null;
      if (!toolbarHasFocus() && !pointerOverToolbarRef.current && !pointerOverHitAreaRef.current) {
        setToolbarVisible(false);
      }
    }, 180);
  }, [clearToolbarHideTimer, toolbarHasFocus]);

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

  const cancelDrag = useCallback((resetDraggingState = true) => {
    const canvas = canvasRef.current;
    const dragState = dragStateRef.current;

    if (canvas && dragState && canvas.hasPointerCapture(dragState.pointerId)) {
      canvas.releasePointerCapture(dragState.pointerId);
    }
    dragStateRef.current = null;
    if (resetDraggingState) setIsDragging(false);
  }, []);

  const cleanupPreviewInteraction = useCallback((resetDraggingState = true) => {
    cancelDrag(resetDraggingState);
    clearToolbarHideTimer();
  }, [cancelDrag, clearToolbarHideTimer]);

  const closePreview = useCallback(() => {
    cleanupPreviewInteraction();
    onClose();
  }, [cleanupPreviewInteraction, onClose]);

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
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    cancelDrag();
  }, [cancelDrag]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      event.stopPropagation();
      closePreview();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [closePreview]);

  useEffect(() => () => cleanupPreviewInteraction(false), [cleanupPreviewInteraction]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      applyingInitialToolbarFocusRef.current = true;
      closeButtonRef.current?.focus();
      applyingInitialToolbarFocusRef.current = false;
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      fitToCanvas();
    });

    return () => cancelAnimationFrame(frameId);
  }, [fitToCanvas, safeSvg]);

  return (
    <div
      className="mermaid-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Mermaid diagram preview"
      onClick={(event) => {
        if (event.target === event.currentTarget) closePreview();
      }}
    >
      <div className="mermaid-preview-dialog">
        <div
          className={`mermaid-preview-canvas${isDragging ? ' mermaid-preview-canvas--dragging' : ''}`}
          ref={canvasRef}
          onWheel={(event) => event.stopPropagation()}
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
              dangerouslySetInnerHTML={{ __html: safeSvg }}
            />
          </div>
        </div>
        <div
          className="mermaid-preview-bottom-hit-area"
          onPointerEnter={() => {
            pointerOverHitAreaRef.current = true;
            showToolbar('pointer');
          }}
          onPointerLeave={() => {
            pointerOverHitAreaRef.current = false;
            scheduleToolbarHide();
          }}
        />
        <div
          ref={toolbarRef}
          className={`mermaid-preview-toolbar mermaid-preview-toolbar--${toolbarVisible ? 'visible' : 'hidden'}`}
          onPointerEnter={() => {
            pointerOverToolbarRef.current = true;
            showToolbar('pointer');
          }}
          onPointerLeave={() => {
            pointerOverToolbarRef.current = false;
            scheduleToolbarHide();
          }}
          onFocus={() => {
            if (!applyingInitialToolbarFocusRef.current) {
              toolbarHasFocusRef.current = true;
            }
            showToolbar('focus');
          }}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            toolbarHasFocusRef.current = false;
            scheduleToolbarHide();
          }}
          onKeyDown={() => showToolbar('keyboard')}
        >
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
            ref={closeButtonRef}
            className="mermaid-preview-toolbar__close"
            type="button"
            aria-label="Close Mermaid preview"
            onClick={closePreview}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
