import { useViewerStore } from '../../store';
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

  const handleToggleMode = () => {
    setMode(mode === 'read' ? 'edit' : 'read');
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
