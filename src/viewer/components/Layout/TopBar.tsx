import { useViewerStore } from '../../store';

interface TopBarProps {
  title: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function TopBar({ title, isSidebarOpen, onToggleSidebar }: TopBarProps) {
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
