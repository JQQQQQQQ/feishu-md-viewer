export type SaveStatusState = 'saved' | 'saving' | 'unsaved' | 'error';

interface SaveStatusProps {
  status: SaveStatusState;
  errorMessage?: string;
  lastSaved?: Date | null;
}

const STATUS_LABELS: Record<SaveStatusState, string> = {
  saved: '已保存',
  saving: '保存中...',
  unsaved: '未保存',
  error: '保存失败',
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SaveStatus({ status, errorMessage, lastSaved }: SaveStatusProps) {
  const label = status === 'error' && errorMessage ? errorMessage : STATUS_LABELS[status];
  const timeLabel = status === 'saved' && lastSaved ? ` at ${formatTime(lastSaved)}` : '';

  return (
    <div
      className={`save-status save-status--${status}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={`save-status__dot save-status__dot--${status}`} aria-hidden="true" />
      <span className="save-status__label">
        {label}
        {timeLabel}
      </span>
    </div>
  );
}
