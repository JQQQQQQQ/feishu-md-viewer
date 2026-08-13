import { useViewerStore, type ThemeMode } from '../../store';

interface TopBarProps {
  title: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
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

export function TopBar({
  title,
  isSidebarOpen,
  onToggleSidebar,
}: TopBarProps) {
  const theme = useViewerStore((s) => s.theme);
  const setTheme = useViewerStore((s) => s.setTheme);
  const fontSize = useViewerStore((s) => s.fontSize);
  const increaseFontSize = useViewerStore((s) => s.increaseFontSize);
  const decreaseFontSize = useViewerStore((s) => s.decreaseFontSize);

  const handleCycleTheme = () => {
    setTheme(THEME_CYCLE[theme]);
  };

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

      <div className="feishu-topbar__actions">
        {/* Font size controls */}
        <div className="feishu-topbar__font-controls" role="group" aria-label="Font size controls">
          <button
            className="feishu-topbar__font-btn"
            onClick={decreaseFontSize}
            type="button"
            aria-label="Decrease font size"
            title={`Decrease font size (${fontSize}px)`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
              <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Theme toggle */}
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
              <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          )}
          {theme === 'dark' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M13.5 9.5a5.5 5.5 0 0 1-7-7 5.5 5.5 0 1 0 7 7Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {theme === 'system' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5 14h6M8 11v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          )}
        </button>

      </div>
    </header>
  );
}
