import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type PropsWithChildren,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  ImageOff,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  X,
} from 'lucide-react';

type ImageProps = ImgHTMLAttributes<HTMLImageElement>;
type ImageLoadState = 'loading' | 'loaded' | 'error';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_FACTOR = 1.2;

function getPortalHost(element: HTMLElement | null): Element | DocumentFragment {
  const root = element?.getRootNode();
  if (root instanceof ShadowRoot) return root;
  return document.body;
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function formatZoom(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function getDownloadFilename(imageUrl: string): string {
  try {
    const pathname = new URL(imageUrl, window.location.href).pathname;
    const filename = pathname.split('/').filter(Boolean).pop();
    if (filename) return decodeURIComponent(filename);
  } catch {
    // Keep a stable fallback for malformed or extension-scoped image URLs.
  }
  return 'image';
}

interface GalleryImage {
  id: string;
  src: string;
  alt: string;
}

interface ImagePreviewContextValue {
  registerImage: (image: GalleryImage) => () => void;
  openImage: (id: string, trigger: HTMLElement | null) => void;
}

const ImagePreviewContext = createContext<ImagePreviewContextValue | null>(null);

interface ImagePreviewModalProps {
  image: GalleryImage;
  index: number;
  total: number;
  portalElement: HTMLElement | null;
  onClose: () => void;
  onNavigate: (offset: number) => void;
}

function ImagePreviewModal({
  image,
  index,
  total,
  portalElement,
  onClose,
  onNavigate,
}: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loadState, setLoadState] = useState<ImageLoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const imageUrl = image.src;
  const caption = useMemo(() => image.alt.trim(), [image.alt]);

  useEffect(() => {
    // Keep the preview shell mounted while navigating. Reset only the image
    // state so the backdrop does not replay its entry animation.
    zoomRef.current = 1;
    setZoom(1);
    setRotation(0);
    setLoadState('loading');
    setNaturalSize(null);
    setReloadToken((token) => token + 1);
  }, [image.id, imageUrl]);

  const rotateImage = useCallback((degrees: number) => {
    setRotation((current) => (current + degrees + 360) % 360);
  }, []);

  const setZoomSafely = useCallback((nextZoom: number) => {
    const canvas = canvasRef.current;
    const previousZoom = zoomRef.current;
    const next = clampZoom(Number(nextZoom.toFixed(3)));
    zoomRef.current = next;

    if (!canvas || previousZoom === next) {
      setZoom(next);
      return;
    }

    const centerX = canvas.scrollLeft + canvas.clientWidth / 2;
    const centerY = canvas.scrollTop + canvas.clientHeight / 2;
    setZoom(next);
    requestAnimationFrame(() => {
      const ratio = next / previousZoom;
      canvas.scrollLeft = Math.max(0, centerX * ratio - canvas.clientWidth / 2);
      canvas.scrollTop = Math.max(0, centerY * ratio - canvas.clientHeight / 2);
    });
  }, []);

  const fitToWindow = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !naturalSize || naturalSize.width <= 0 || naturalSize.height <= 0) {
      setZoom(1);
      return;
    }
    const availableWidth = Math.max(1, canvas.clientWidth - 48);
    const availableHeight = Math.max(1, canvas.clientHeight - 48);
    setZoomSafely(
      Math.min(1, availableWidth / naturalSize.width, availableHeight / naturalSize.height),
    );
  }, [naturalSize, setZoomSafely]);

  const handleImageLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    setNaturalSize({ width: image.naturalWidth || 0, height: image.naturalHeight || 0 });
    setLoadState('loaded');
  }, []);

  const handleImageError = useCallback(() => setLoadState('error'), []);

  const retryImage = useCallback(() => {
    setLoadState('loading');
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && index > 0) onNavigate(-1);
      if (event.key === 'ArrowRight' && index < total - 1) onNavigate(1);
    };
    document.addEventListener('keydown', handleKeyDown);
    const frameId = requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(frameId);
    };
  }, [index, onClose, onNavigate, total]);

  useEffect(() => {
    if (loadState !== 'loaded' || !naturalSize) return undefined;
    const frameId = requestAnimationFrame(fitToWindow);
    return () => cancelAnimationFrame(frameId);
  }, [fitToWindow, loadState, naturalSize]);

  const dialogLabel = caption ? `图片预览：${caption}` : '图片预览';
  const downloadFilename = getDownloadFilename(imageUrl);
  const isQuarterTurn = rotation % 180 !== 0;
  const contentStyle =
    naturalSize && zoom > 1
      ? {
          width: (isQuarterTurn ? naturalSize.height : naturalSize.width) * zoom,
          height: (isQuarterTurn ? naturalSize.width : naturalSize.height) * zoom,
        }
      : undefined;
  const modal = createPortal(
    <div className="feishu-image-preview" role="dialog" aria-modal="true" aria-label={dialogLabel}>
      <button
        type="button"
        className="feishu-image-preview__backdrop"
        onClick={onClose}
        aria-label="关闭图片预览"
      />
      <div className="feishu-image-preview__stage">
        {/* The canvas is intentionally a mouse-dismiss surface; the backdrop
         * button remains the keyboard-accessible dismissal control. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          ref={canvasRef}
          className="feishu-image-preview__canvas"
          onClick={(event) => {
            const target = event.target as Element;
            if (!target.closest('img, button, a')) onClose();
          }}
        >
          {loadState === 'error' ? (
            <div className="feishu-image-preview__status" role="status">
              <span className="feishu-image-preview__status-icon">
                <ImageOff size={22} strokeWidth={1.8} />
              </span>
              <strong>图片加载失败</strong>
              <span>请检查网络或图片地址后重试</span>
              <button type="button" className="feishu-image-preview__retry" onClick={retryImage}>
                重新加载图片
              </button>
            </div>
          ) : (
            <div className="feishu-image-preview__content" style={contentStyle}>
              {loadState === 'loading' && (
                <span className="feishu-image-preview__loading" role="status">
                  正在加载图片…
                </span>
              )}
              <img
                key={reloadToken}
                className={`feishu-image-preview__image${zoom > 1 ? ' feishu-image-preview__image--zoomed' : ''}`}
                src={imageUrl}
                alt={image.alt}
                onLoad={handleImageLoad}
                onError={handleImageError}
                draggable={false}
                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                onPointerDown={(event: ReactPointerEvent<HTMLImageElement>) =>
                  event.stopPropagation()
                }
              />
            </div>
          )}
        </div>
        <div
          className="feishu-image-preview__floating-toolbar"
          role="toolbar"
          aria-label="图片预览操作"
        >
          <div className="feishu-image-preview__floating-controls" aria-label="图片预览控制">
            <button
              type="button"
              className="feishu-image-preview__floating-icon"
              onClick={() => onNavigate(-1)}
              disabled={index <= 0}
              aria-label="上一张图片"
              title="上一张图片"
            >
              <ChevronLeft size={17} strokeWidth={2} />
            </button>
            <span
              className="feishu-image-preview__image-position"
              role="status"
              aria-label="图片位置"
            >
              {index + 1} / {total}
            </span>
            <button
              type="button"
              className="feishu-image-preview__floating-icon"
              onClick={() => onNavigate(1)}
              disabled={index >= total - 1}
              aria-label="下一张图片"
              title="下一张图片"
            >
              <ChevronRight size={17} strokeWidth={2} />
            </button>
            <span className="feishu-image-preview__floating-divider" aria-hidden="true" />
            <button
              type="button"
              className="feishu-image-preview__floating-button"
              onClick={fitToWindow}
              aria-label="适应窗口"
              title="适应窗口"
            >
              适应
            </button>
            <button
              type="button"
              className="feishu-image-preview__floating-button"
              onClick={() => {
                setZoomSafely(1);
                setRotation(0);
              }}
              aria-label="恢复原始尺寸"
              title="恢复原始尺寸"
            >
              <RotateCcw size={15} strokeWidth={2} />
              <span>原始</span>
            </button>
            <button
              type="button"
              className="feishu-image-preview__floating-icon"
              onClick={() => setZoomSafely(zoom / ZOOM_FACTOR)}
              aria-label="缩小图片"
              title="缩小图片"
            >
              <Minus size={16} strokeWidth={2} />
            </button>
            <span className="feishu-image-preview__zoom" aria-live="polite">
              {formatZoom(zoom)}
            </span>
            <button
              type="button"
              className="feishu-image-preview__floating-icon"
              onClick={() => setZoomSafely(zoom * ZOOM_FACTOR)}
              aria-label="放大图片"
              title="放大图片"
            >
              <Plus size={16} strokeWidth={2} />
            </button>
            <span className="feishu-image-preview__floating-divider" aria-hidden="true" />
            <button
              type="button"
              className="feishu-image-preview__floating-icon"
              onClick={() => rotateImage(-90)}
              aria-label="向左旋转"
              title="向左旋转"
            >
              <RotateCcw size={16} strokeWidth={2} />
            </button>
            <span className="feishu-image-preview__rotation" aria-live="polite">
              {rotation}°
            </span>
            <button
              type="button"
              className="feishu-image-preview__floating-icon"
              onClick={() => rotateImage(90)}
              aria-label="向右旋转"
              title="向右旋转"
            >
              <RotateCw size={16} strokeWidth={2} />
            </button>
            <span className="feishu-image-preview__floating-divider" aria-hidden="true" />
            <a
              className="feishu-image-preview__floating-icon"
              href={imageUrl}
              download={downloadFilename}
              aria-label="下载图片"
              title="下载图片"
            >
              <Download size={16} strokeWidth={2} />
            </a>
            <a
              className="feishu-image-preview__floating-icon"
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="在新标签打开图片"
              title="在新标签打开图片"
            >
              <ExternalLink size={16} strokeWidth={2} />
            </a>
            <button
              ref={closeButtonRef}
              type="button"
              className="feishu-image-preview__floating-close"
              onClick={onClose}
              aria-label="关闭图片预览"
              title="关闭"
            >
              <X size={17} strokeWidth={2.1} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    getPortalHost(portalElement),
  );

  return modal;
}

export function ImagePreviewProvider({ children }: PropsWithChildren) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTriggerRef = useRef<HTMLElement | null>(null);

  const registerImage = useCallback((image: GalleryImage) => {
    setImages((current) =>
      current.some((item) => item.id === image.id) ? current : [...current, image],
    );
    return () => setImages((current) => current.filter((item) => item.id !== image.id));
  }, []);

  const openImage = useCallback((id: string, trigger: HTMLElement | null) => {
    activeTriggerRef.current = trigger;
    setActiveId(id);
  }, []);

  const activeIndex = activeId ? images.findIndex((image) => image.id === activeId) : -1;
  const activeImage = activeIndex >= 0 ? images[activeIndex] : null;

  const closePreview = useCallback(() => {
    setActiveId(null);
    requestAnimationFrame(() => activeTriggerRef.current?.focus());
  }, []);

  const navigate = useCallback(
    (offset: number) => {
      setActiveId((currentId) => {
        if (!currentId) return currentId;
        const currentIndex = images.findIndex((image) => image.id === currentId);
        const nextImage = images[currentIndex + offset];
        return nextImage?.id ?? currentId;
      });
    },
    [images],
  );

  const contextValue = useMemo(() => ({ registerImage, openImage }), [openImage, registerImage]);

  return (
    <ImagePreviewContext.Provider value={contextValue}>
      {children}
      {activeImage && (
        <ImagePreviewModal
          image={activeImage}
          index={activeIndex}
          total={images.length}
          portalElement={activeTriggerRef.current}
          onClose={closePreview}
          onNavigate={navigate}
        />
      )}
    </ImagePreviewContext.Provider>
  );
}

export function FeishuImage({ alt = '', src, ...props }: ImageProps) {
  const gallery = useContext(ImagePreviewContext);
  const imageId = useId();
  const [open, setOpen] = useState(false);
  const imageUrl = typeof src === 'string' ? src : '';
  const caption = useMemo(() => alt.trim(), [alt]);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!gallery || !imageUrl) return undefined;
    return gallery.registerImage({ id: imageId, src: imageUrl, alt });
  }, [alt, gallery, imageId, imageUrl]);

  const closePreview = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openPreview = useCallback(() => {
    if (gallery) {
      gallery.openImage(imageId, triggerRef.current);
      return;
    }
    setOpen(true);
  }, [gallery, imageId]);

  if (!imageUrl) {
    return <img className="feishu-image" loading="lazy" alt={alt} src={src} {...props} />;
  }

  const modal =
    open && !gallery ? (
      <ImagePreviewModal
        image={{ id: imageId, src: imageUrl, alt }}
        index={0}
        total={1}
        portalElement={triggerRef.current}
        onClose={closePreview}
        onNavigate={() => undefined}
      />
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="feishu-image-trigger"
        onClick={openPreview}
        aria-label={caption ? `预览图片：${caption}` : '预览图片'}
      >
        <img className="feishu-image" loading="lazy" alt={alt} src={src} {...props} />
      </button>
      {modal}
    </>
  );
}
