import { useViewerStore, type ThemeMode } from '../../store';
import { SaveStatus, type SaveStatusState } from '../Common/SaveStatus';

interface TopBarProps {
  title: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSave?: () => void;
  saveStatus?: SaveStatusState;
  saveError?: string | null;
  lastSaved?: Date | null;
  showSaveControls?: boolean;
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
  onSave,
  saveStatus = 'saved',
  saveError,
  lastSaved,
  showSaveControls = false,
}: TopBarProps) {
  const mode = useViewerStore((s) => s.mode);
  const setMode = useViewerStore((s) => s.setMode);
  const isDirty = useViewerStore((s) => s.isDirty);
  const theme = useViewerStore((s) => s.theme);
  const setTheme = useViewerStore((s) => s.setTheme);
  const fontSize = useViewerStore((s) => s.fontSize);
  const increaseFontSize = useViewerStore((s) => s.increaseFontSize);
  const decreaseFontSize = useViewerStore((s) => s.decreaseFontSize);

  const handleToggleMode = () => {
    setMode(mode === 'read' ? 'edit' : 'read');
  };

  const handleCycleTheme = () => {
    setTheme(THEME_CYCLE[theme]);
  };

  const modeToggleClass = [
    'feishu-topbar__mode-toggle',
    mode === 'edit' ? 'feishu-topbar__mode-toggle--active' : '',
  ]
    .filter(Boolean)
    .join(' ');

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
      <span className="feishu-topbar__brand">Feishu MD Viewer</span>
      {title && (
        <>
          <span className="feishu-topbar__separator" aria-hidden="true" />
          <span className="feishu-topbar__title">{title}</span>
        </>
      )}

      {showSaveControls && (
        <div className="feishu-topbar__save-section">
          <SaveStatus
            status={saveStatus}
            errorMessage={saveError ?? undefined}
            lastSaved={lastSaved}
          />
          <button
            className="feishu-topbar__save-btn"
            onClick={onSave}
            type="button"
            aria-label="Save document"
            title="Save (Ctrl+S)"
            disabled={!isDirty && saveStatus === 'saved'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12.667 14H3.333A1.333 1.333 0 0 1 2 12.667V3.333A1.333 1.333 0 0 1 3.333 2h7.334L14 5.333v7.334A1.333 1.333 0 0 1 12.667 14Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M11.333 14V9.333H4.667V14"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4.667 2v3.333h5.333"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

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

      <button
        className={modeToggleClass}
        onClick={handleToggleMode}
        type="button"
        aria-pressed={mode === 'edit'}
        aria-label={mode === 'edit' ? 'Switch to read mode' : 'Switch to edit mode'}
      >
        {mode === 'edit' ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M1 7.5L5 11.5L13 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M10.5 1.75L12.25 3.5M1.75 12.25L2.333 9.917L10.083 2.167L11.833 3.917L4.083 11.667L1.75 12.25Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {mode === 'edit' ? 'Reading' : 'Edit'}
        {isDirty && <span className="feishu-topbar__dirty-indicator" aria-label="Unsaved changes" />}
      </button>
    </header>
  );
}
