import { useCallback, useEffect, useRef } from 'react';
import type { TOCItem } from '../../hooks/useTOC';
import { TableOfContents } from '../TOC/TableOfContents';

interface SidebarProps {
  isOpen: boolean;
  items: TOCItem[];
  containerRef: React.RefObject<HTMLElement | null>;
  isDrawerMode: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, items, containerRef, isDrawerMode, onClose }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);

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

  const sidebarClassName = [
    'feishu-sidebar',
    !isOpen ? 'feishu-sidebar--collapsed' : '',
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
        aria-hidden={!isOpen}
      >
        <div className="feishu-sidebar__content">
          <TableOfContents items={items} containerRef={containerRef} />
        </div>
      </aside>
    </>
  );
}
