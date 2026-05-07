import { useCallback, useEffect, useMemo, useRef, useState, type ImgHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';

type ImageProps = ImgHTMLAttributes<HTMLImageElement>;

function getPortalHost(element: HTMLElement | null): Element | DocumentFragment {
  const root = element?.getRootNode();
  if (root instanceof ShadowRoot) {
    return root;
  }
  return document.body;
}

export function FeishuImage({ alt = '', src, ...props }: ImageProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const imageUrl = typeof src === 'string' ? src : '';
  const caption = useMemo(() => alt.trim(), [alt]);

  const closePreview = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePreview();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePreview, open]);

  if (!imageUrl) {
    return <img className="feishu-image" loading="lazy" alt={alt} src={src} {...props} />;
  }

  const modal = open ? createPortal(
    <div className="feishu-image-preview" role="dialog" aria-modal="true" aria-label={caption || '图片预览'}>
      <button type="button" className="feishu-image-preview__backdrop" onClick={closePreview} aria-label="关闭图片预览" />
      <div className="feishu-image-preview__panel">
        <div className="feishu-image-preview__toolbar">
          {caption && <span className="feishu-image-preview__caption">{caption}</span>}
          <a
            className="feishu-image-preview__action"
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="在新标签打开图片"
          >
            <ExternalLink size={16} strokeWidth={2} />
          </a>
          <button type="button" className="feishu-image-preview__action" onClick={closePreview} aria-label="关闭图片预览">
            <X size={18} strokeWidth={2.1} />
          </button>
        </div>
        <img className="feishu-image-preview__image" src={imageUrl} alt={alt} />
      </div>
    </div>,
    getPortalHost(triggerRef.current)
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="feishu-image-trigger"
        onClick={() => setOpen(true)}
        aria-label={caption ? `预览图片：${caption}` : '预览图片'}
      >
        <img className="feishu-image" loading="lazy" alt={alt} src={src} {...props} />
      </button>
      {modal}
    </>
  );
}
