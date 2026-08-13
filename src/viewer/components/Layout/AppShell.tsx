import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { TOCItem } from '../../hooks/useTOC';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';

const SIDEBAR_WIDTH_STORAGE_KEY = 'feishu-md-viewer-sidebar-width';
const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 520;
const MAIN_MIN_READABLE_WIDTH = 980;
const MAIN_MAX_OFFSET = 400;

interface AppShellProps {
  title: string;
  tocItems: TOCItem[];
  children: ReactNode;
}

function useIsDrawerMode(): boolean {
  const [isDrawer, setIsDrawer] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    setIsDrawer(mql.matches);

    const handler = (e: MediaQueryListEvent) => {
      setIsDrawer(e.matches);
    };

    mql.addEventListener('change', handler);
    return () => {
      mql.removeEventListener('change', handler);
    };
  }, []);

  return isDrawer;
}

function getStoredSidebarWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_WIDTH;

  let stored = Number.NaN;
  try {
    stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
  if (!Number.isFinite(stored)) return DEFAULT_SIDEBAR_WIDTH;
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, stored));
}

export function computeMainOffset(sidebarWidth: number, viewportWidth: number): number {
  if (!Number.isFinite(sidebarWidth) || !Number.isFinite(viewportWidth)) return 0;
  const available = Math.max(0, viewportWidth - MAIN_MIN_READABLE_WIDTH);
  return Math.max(0, Math.min(sidebarWidth, MAIN_MAX_OFFSET, available));
}

export function AppShell({
  title,
  tocItems,
  children,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(getStoredSidebarWidth);
  const contentRef = useRef<HTMLElement | null>(null);
  const isDrawerMode = useIsDrawerMode();
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const handleSidebarWidthChange = useCallback((width: number) => {
    const nextWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
    setSidebarWidth(nextWidth);
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(Math.round(nextWidth)));
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }, []);

  useEffect(() => {
    if (isDrawerMode && sidebarOpen) {
      setSidebarOpen(false);
    }
    // Only react to drawer mode change, not sidebarOpen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawerMode]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const mainClassName = [
    'feishu-app-shell__main',
    !sidebarOpen ? 'feishu-app-shell__main--collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="feishu-app-shell"
      style={{
        '--feishu-sidebar-width': `${sidebarWidth}px`,
        '--feishu-main-offset': `${computeMainOffset(sidebarWidth, viewportWidth)}px`,
      } as React.CSSProperties}
    >
      <a href="#main-content" className="feishu-skip-link">
        Skip to content
      </a>
      <TopBar
        title={title}
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />
      <div className="feishu-app-shell__body">
        <Sidebar
          isOpen={sidebarOpen}
          items={tocItems}
          containerRef={contentRef}
          isDrawerMode={isDrawerMode}
          onClose={handleCloseSidebar}
          onWidthChange={handleSidebarWidthChange}
        />
        <main
          id="main-content"
          ref={contentRef}
          className={mainClassName}
          role="main"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
