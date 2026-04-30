interface TopBarProps {
  title: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function TopBar({ title, isSidebarOpen, onToggleSidebar }: TopBarProps) {
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
    </header>
  );
}
