import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { TOCItem } from '../../hooks/useTOC';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { ContentUpdateNotice } from '../Common/ContentUpdateNotice';
import { useViewerStore } from '../../store';

const SIDEBAR_WIDTH_STORAGE_KEY = 'feishu-md-viewer-sidebar-width';
const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 520;
const MAIN_MIN_READABLE_WIDTH = 980;
const MAIN_MAX_OFFSET = 400;
const TABLE_SCROLL_THRESHOLD_PX = 8;
const DRAWER_BREAKPOINT_PX = 767;

export function shouldHideSidebarForTableScroll(scrollLeft: number): boolean {
  return Number.isFinite(scrollLeft) && scrollLeft > TABLE_SCROLL_THRESHOLD_PX;
}

export function resolveSidebarToggleState(
  sidebarOpen: boolean,
  tableScrollHidden: boolean,
): { sidebarOpen: boolean; tableScrollHidden: boolean } {
  if (tableScrollHidden) {
    return { sidebarOpen: true, tableScrollHidden: false };
  }

  return { sidebarOpen: !sidebarOpen, tableScrollHidden: false };
}

interface AppShellProps {
  title: string;
  tocItems: TOCItem[];
  children: ReactNode;
  settingsEnabled?: boolean;
  contentUpdateAvailable?: boolean;
  contentUpdateRefreshing?: boolean;
  onRefreshContent?: () => void;
}

function resolveStableDrawerMode(mediaMatches: boolean): boolean | null {
  if (!document.hasFocus()) return null;

  const viewportWidth = window.innerWidth;
  const documentWidth = document.documentElement.clientWidth;
  if (
    !Number.isFinite(viewportWidth)
    || !Number.isFinite(documentWidth)
    || viewportWidth <= 0
    || documentWidth <= 0
  ) return null;

  const viewportIsDrawer = viewportWidth <= DRAWER_BREAKPOINT_PX;
  const documentIsDrawer = documentWidth <= DRAWER_BREAKPOINT_PX;
  if (viewportIsDrawer !== documentIsDrawer || viewportIsDrawer !== mediaMatches) return null;
  return mediaMatches;
}

function useIsDrawerMode(): boolean {
  const [isDrawer, setIsDrawer] = useState(() => (
    typeof window !== 'undefined'
    && document.visibilityState !== 'hidden'
    && window.matchMedia('(max-width: 767px)').matches
  ));
  const resumeFrameRef = useRef<number>();
  const settleFrameRef = useRef<number>();
  const isResumingRef = useRef(false);
  const isWindowFocusedRef = useRef(true);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    setIsDrawer(mql.matches);

    const cancelResumeFrames = () => {
      if (resumeFrameRef.current !== undefined) {
        window.cancelAnimationFrame(resumeFrameRef.current);
        resumeFrameRef.current = undefined;
      }
      if (settleFrameRef.current !== undefined) {
        window.cancelAnimationFrame(settleFrameRef.current);
        settleFrameRef.current = undefined;
      }
    };
    const scheduleResumeReconcile = () => {
      cancelResumeFrames();
      isResumingRef.current = true;
      resumeFrameRef.current = window.requestAnimationFrame(() => {
        resumeFrameRef.current = undefined;
        settleFrameRef.current = window.requestAnimationFrame(() => {
          settleFrameRef.current = undefined;
          if (document.visibilityState === 'hidden' || !isWindowFocusedRef.current) {
            return;
          }
          isResumingRef.current = false;
          const stableMode = resolveStableDrawerMode(mql.matches);
          if (stableMode !== null) setIsDrawer(stableMode);
        });
      });
    };
    const handler = (e: MediaQueryListEvent) => {
      if (
        document.visibilityState === 'hidden'
        || !isWindowFocusedRef.current
        || isResumingRef.current
      ) return;
      const stableMode = resolveStableDrawerMode(e.matches);
      if (stableMode !== null) setIsDrawer(stableMode);
    };
    const handleVisibilityChange = () => {
      cancelResumeFrames();
      isResumingRef.current = true;
      if (document.visibilityState === 'hidden' || !isWindowFocusedRef.current) {
        return;
      }
      scheduleResumeReconcile();
    };
    const handleWindowBlur = () => {
      isWindowFocusedRef.current = false;
      isResumingRef.current = true;
      cancelResumeFrames();
    };
    const handleWindowFocus = () => {
      isWindowFocusedRef.current = true;
      if (document.visibilityState !== 'hidden') scheduleResumeReconcile();
    };

    mql.addEventListener('change', handler);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      mql.removeEventListener('change', handler);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      cancelResumeFrames();
      isResumingRef.current = false;
      isWindowFocusedRef.current = true;
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
  settingsEnabled = true,
  contentUpdateAvailable = false,
  contentUpdateRefreshing = false,
  onRefreshContent,
}: AppShellProps) {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(getStoredSidebarWidth);
  const contentRef = useRef<HTMLElement | null>(null);
  const isDrawerMode = useIsDrawerMode();
  const [tableScrollHidden, setTableScrollHidden] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  const sidebarDividerVisible = useViewerStore((state) => state.sidebarDividerVisible);
  const sidebarOpen = isDrawerMode ? drawerOpen : desktopSidebarOpen;

  const handleToggleSidebar = useCallback(() => {
    if (isDrawerMode) {
      setDrawerOpen((open) => !open);
      setTableScrollHidden(false);
      return;
    }

    const next = resolveSidebarToggleState(desktopSidebarOpen, tableScrollHidden);
    setDesktopSidebarOpen(next.sidebarOpen);
    setTableScrollHidden(next.tableScrollHidden);
  }, [desktopSidebarOpen, isDrawerMode, tableScrollHidden]);

  const handleCloseSidebar = useCallback(() => {
    if (isDrawerMode) {
      setDrawerOpen(false);
    } else {
      setDesktopSidebarOpen(false);
    }
  }, [isDrawerMode]);

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
    if (!isDrawerMode) return;
    setDrawerOpen(false);
    setTableScrollHidden(false);
  }, [isDrawerMode]);

  useEffect(() => {
    const main = contentRef.current;
    if (!main) return undefined;

    const handleTableScroll = (event: Event) => {
      if (isDrawerMode) return;
      const detail = (event as CustomEvent<{ scrollLeft?: number }>).detail;
      setTableScrollHidden(shouldHideSidebarForTableScroll(Number(detail?.scrollLeft ?? 0)));
    };

    main.addEventListener('feishu-table-horizontal-scroll', handleTableScroll);
    return () => main.removeEventListener('feishu-table-horizontal-scroll', handleTableScroll);
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
    tableScrollHidden ? 'feishu-app-shell__main--table-scrolling' : '',
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
        settingsEnabled={settingsEnabled}
      />
      {contentUpdateAvailable && onRefreshContent && (
        <ContentUpdateNotice
          onRefresh={onRefreshContent}
          isRefreshing={contentUpdateRefreshing}
        />
      )}
      <div className="feishu-app-shell__body">
        <Sidebar
          isOpen={sidebarOpen}
          items={tocItems}
          containerRef={contentRef}
          isDrawerMode={isDrawerMode}
          isTableScrollHidden={tableScrollHidden}
          dividerVisible={sidebarDividerVisible}
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
