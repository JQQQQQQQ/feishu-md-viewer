import { useCallback, useEffect, useRef, useState } from 'react';
import type { TOCItem } from '../../hooks/useTOC';
import { TableOfContents } from '../TOC/TableOfContents';

interface SidebarProps {
  isOpen: boolean;
  items: TOCItem[];
  containerRef: React.RefObject<HTMLElement | null>;
  isDrawerMode: boolean;
  isTableScrollHidden?: boolean;
  dividerVisible?: boolean;
  onClose: () => void;
  onWidthChange: (width: number) => void;
}

export function Sidebar({
  isOpen,
  items,
  containerRef,
  isDrawerMode,
  isTableScrollHidden = false,
  dividerVisible = true,
  onClose,
  onWidthChange,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const isResizingRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerMode && isOpen) {
        onClose();
      }
    },
    [isDrawerMode, isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen && isDrawerMode && sidebarRef.current) {
      const firstFocusable = sidebarRef.current.querySelector<HTMLElement>(
        'button, [href], [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [isOpen, isDrawerMode]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isResizingRef.current || isDrawerMode) return;
      onWidthChange(event.clientX);
    };

    const handlePointerUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDrawerMode, onWidthChange]);

  const handleResizePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isDrawerMode || !isOpen) return;

    event.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isDrawerMode, isOpen]);

  const sidebarClassName = [
    'feishu-sidebar',
    !isOpen ? 'feishu-sidebar--collapsed' : '',
    !dividerVisible ? 'feishu-sidebar--divider-hidden' : '',
    isTableScrollHidden ? 'feishu-sidebar--table-scrolling' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const backdropClassName = [
    'feishu-sidebar-backdrop',
    !isOpen ? 'feishu-sidebar-backdrop--hidden' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {isDrawerMode && (
        <div
          className={backdropClassName}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        ref={sidebarRef}
        className={sidebarClassName}
        aria-label="Document navigation"
        aria-hidden={!isOpen || isTableScrollHidden}
      >
        <div className="feishu-sidebar__content">
          <TableOfContents items={items} containerRef={containerRef} />
        </div>
        {!isDrawerMode && isOpen && (
          <div
            className={`feishu-sidebar__resize-handle${dividerVisible ? '' : ' feishu-sidebar__resize-handle--hidden'}${isResizing ? ' feishu-sidebar__resize-handle--resizing' : ''}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize document navigation"
            onPointerDown={handleResizePointerDown}
          />
        )}
      </aside>
    </>
  );
}
