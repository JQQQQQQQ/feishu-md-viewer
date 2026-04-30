import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { TOCItem } from '../../hooks/useTOC';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';

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

export function AppShell({ title, tocItems, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const contentRef = useRef<HTMLElement | null>(null);
  const isDrawerMode = useIsDrawerMode();

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (isDrawerMode && sidebarOpen) {
      setSidebarOpen(false);
    }
    // Only react to drawer mode change, not sidebarOpen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawerMode]);

  const mainClassName = [
    'feishu-app-shell__main',
    !sidebarOpen ? 'feishu-app-shell__main--collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="feishu-app-shell">
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
