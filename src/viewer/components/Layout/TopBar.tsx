import { useEffect, useRef, useState } from 'react';
import { useViewerStore, type ContentAlignment, type ThemeMode } from '../../store';

interface TopBarProps {
  title: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  settingsEnabled?: boolean;
}

const THEME_ICONS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Auto',
};

const THEME_CYCLE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

function SettingsControls() {
  const theme = useViewerStore((s) => s.theme);
  const setTheme = useViewerStore((s) => s.setTheme);
  const fontSize = useViewerStore((s) => s.fontSize);
  const increaseFontSize = useViewerStore((s) => s.increaseFontSize);
  const decreaseFontSize = useViewerStore((s) => s.decreaseFontSize);
  const tocFontSize = useViewerStore((s) => s.tocFontSize);
  const setTocFontSize = useViewerStore((s) => s.setTocFontSize);
  const tocSmoothScrollEnabled = useViewerStore((s) => s.tocSmoothScrollEnabled);
  const setTocSmoothScrollEnabled = useViewerStore((s) => s.setTocSmoothScrollEnabled);
  const sidebarDividerVisible = useViewerStore((s) => s.sidebarDividerVisible);
  const setSidebarDividerVisible = useViewerStore((s) => s.setSidebarDividerVisible);
  const contentAlignment = useViewerStore((s) => s.contentAlignment);
  const setContentAlignment = useViewerStore((s) => s.setContentAlignment);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlignmentMenuOpen, setIsAlignmentMenuOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const alignmentControlRef = useRef<HTMLDivElement>(null);

  const handleCycleTheme = () => {
    setTheme(THEME_CYCLE[theme]);
  };

  useEffect(() => {
    if (!isSettingsOpen) return undefined;

    const closeWhenOutside = (event: MouseEvent) => {
      const control = settingsRef.current;
      const occurredInsideSettings = control ? event.composedPath().includes(control) : false;
      if (!occurredInsideSettings) {
        setIsSettingsOpen(false);
        setIsAlignmentMenuOpen(false);
      }
    };
    const closeWhenEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false);
        setIsAlignmentMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeWhenOutside);
    document.addEventListener('keydown', closeWhenEscape);
    return () => {
      document.removeEventListener('mousedown', closeWhenOutside);
      document.removeEventListener('keydown', closeWhenEscape);
    };
  }, [isSettingsOpen]);

  const selectContentAlignment = (alignment: ContentAlignment) => {
    setContentAlignment(alignment);
    setIsAlignmentMenuOpen(false);
  };

  return (
    <div className="feishu-topbar__actions">
      <div className="feishu-topbar__settings" ref={settingsRef}>
        <button
          className="feishu-topbar__settings-trigger"
          onClick={() => setIsSettingsOpen((open) => !open)}
          type="button"
          aria-label="打开阅读设置"
          aria-haspopup="dialog"
          aria-expanded={isSettingsOpen}
          title="阅读设置"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6.75 1.75h2.5l.35 1.42c.3.1.58.22.85.36l1.28-.7 1.77 1.77-.7 1.28c.14.27.26.55.36.85l1.42.35v2.5l-1.42.35c-.1.3-.22.58-.36.85l.7 1.28-1.77 1.77-1.28-.7c-.27.14-.55.26-.85.36l-.35 1.42h-2.5l-.35-1.42a5.9 5.9 0 0 1-.85-.36l-1.28.7-1.77-1.77.7-1.28a5.9 5.9 0 0 1-.36-.85L1.42 9.58v-2.5l1.42-.35c.1-.3.22-.58.36-.85l-.7-1.28 1.77-1.77 1.28.7c.27-.14.55-.26.85-.36l.35-1.42Z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="8.33" r="2.15" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          设置
        </button>

        {isSettingsOpen && (
          <div className="feishu-topbar__settings-panel" role="dialog" aria-label="阅读设置">
            <div className="feishu-topbar__settings-heading">阅读设置</div>

            <div className="feishu-topbar__settings-section">
              <div className="feishu-topbar__settings-label">正文大小</div>
              <div
                className="feishu-topbar__font-controls"
                role="group"
                aria-label="Font size controls"
              >
                <button
                  className="feishu-topbar__font-btn"
                  onClick={decreaseFontSize}
                  type="button"
                  aria-label="Decrease font size"
                  title={`Decrease font size (${fontSize}px)`}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path
                      d="M3 7h8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <span className="feishu-topbar__font-size" aria-live="polite" aria-atomic="true">
                  {fontSize}
                </span>
                <button
                  className="feishu-topbar__font-btn"
                  onClick={increaseFontSize}
                  type="button"
                  aria-label="Increase font size"
                  title={`Increase font size (${fontSize}px)`}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path
                      d="M7 3v8M3 7h8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="feishu-topbar__settings-section">
              <div className="feishu-topbar__settings-label">目录字号</div>
              <div
                className="feishu-topbar__font-controls"
                role="group"
                aria-label="TOC font size controls"
              >
                <button
                  className="feishu-topbar__font-btn"
                  onClick={() => setTocFontSize(tocFontSize - 1)}
                  type="button"
                  aria-label="Decrease TOC font size"
                  title="减小目录字号"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path
                      d="M3 7h8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <span className="feishu-topbar__font-size" aria-live="polite" aria-atomic="true">
                  {tocFontSize}
                </span>
                <button
                  className="feishu-topbar__font-btn"
                  onClick={() => setTocFontSize(tocFontSize + 1)}
                  type="button"
                  aria-label="Increase TOC font size"
                  title="增大目录字号"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path
                      d="M7 3v8M3 7h8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="feishu-topbar__settings-section feishu-topbar__settings-section--actions">
              <button
                className="feishu-topbar__theme-btn"
                onClick={handleCycleTheme}
                type="button"
                aria-label={`Theme: ${theme}. Click to switch.`}
                title={`Theme: ${THEME_ICONS[theme]}`}
              >
                {theme === 'light' && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
                    <path
                      d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                {theme === 'dark' && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M13.5 9.5a5.5 5.5 0 0 1-7-7 5.5 5.5 0 1 0 7 7Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {theme === 'system' && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect
                      x="2"
                      y="3"
                      width="12"
                      height="8"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                    <path
                      d="M5 14h6M8 11v3"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                <span>{THEME_ICONS[theme]}</span>
              </button>
              <button
                className="feishu-topbar__smooth-btn"
                onClick={() => setTocSmoothScrollEnabled(!tocSmoothScrollEnabled)}
                type="button"
                aria-pressed={tocSmoothScrollEnabled}
                aria-label={`TOC scroll: ${tocSmoothScrollEnabled ? 'smooth' : 'instant'}`}
                title={tocSmoothScrollEnabled ? '目录平滑滚动：开' : '目录平滑滚动：关'}
              >
                {tocSmoothScrollEnabled ? '平滑' : '即时'}
              </button>
              <button
                className="feishu-topbar__smooth-btn"
                onClick={() => setSidebarDividerVisible(!sidebarDividerVisible)}
                type="button"
                aria-pressed={sidebarDividerVisible}
                aria-label="目录与正文分隔线"
                title={
                  sidebarDividerVisible
                    ? '目录与正文分隔线：显示'
                    : '目录与正文分隔线：隐藏（仍可拖拽边缘调整）'
                }
              >
                分隔线
              </button>
            </div>

            <div className="feishu-topbar__settings-section">
              <div className="feishu-topbar__settings-label">正文对齐</div>
              <div className="feishu-topbar__alignment" ref={alignmentControlRef}>
                <button
                  className="feishu-topbar__smooth-btn"
                  onClick={() => setIsAlignmentMenuOpen((open) => !open)}
                  type="button"
                  aria-label="正文对齐"
                  aria-haspopup="menu"
                  aria-expanded={isAlignmentMenuOpen}
                  title={`正文对齐：${contentAlignment === 'left' ? '靠左' : '居中'}`}
                >
                  {contentAlignment === 'left' ? '靠左' : '居中'}
                </button>
                {isAlignmentMenuOpen && (
                  <div className="feishu-topbar__alignment-menu" role="menu" aria-label="正文对齐">
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={contentAlignment === 'left'}
                      onClick={() => selectContentAlignment('left')}
                    >
                      正文靠左
                    </button>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={contentAlignment === 'center'}
                      onClick={() => selectContentAlignment('center')}
                    >
                      正文居中
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TopBar({
  title,
  isSidebarOpen,
  onToggleSidebar,
  settingsEnabled = true,
}: TopBarProps) {
  return (
    <header className="feishu-topbar">
      <button
        className="feishu-topbar__toggle"
        onClick={onToggleSidebar}
        aria-expanded={isSidebarOpen}
        aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M2 4.5h14M2 9h14M2 13.5h14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span className="feishu-topbar__brand">飞书文档</span>
      {title && (
        <>
          <span className="feishu-topbar__separator" aria-hidden="true" />
          <span className="feishu-topbar__title">{title}</span>
        </>
      )}

      {settingsEnabled && <SettingsControls />}
    </header>
  );
}
