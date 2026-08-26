export interface LocalFileChangeMonitorOptions {
  initialContent: string;
  readCurrent: () => Promise<string | null>;
  onChanged: (content: string) => void;
  intervalMs?: number;
}

export interface LocalFileChangeMonitor {
  start: () => void;
  stop: () => void;
  setBaseline: (content: string) => void;
}

/**
 * Polls a local file without ever replacing the current preview by itself.
 * A change is reported once until the caller accepts a new baseline. Failed
 * reads are ignored so a temporary file:// permission error does not break the
 * already-rendered document.
 */
export function createLocalFileChangeMonitor({
  initialContent,
  readCurrent,
  onChanged,
  intervalMs = 3000,
}: LocalFileChangeMonitorOptions): LocalFileChangeMonitor {
  let baseline = initialContent;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let checking = false;
  let changePending = false;

  const schedule = () => {
    if (!running) return;
    timer = setTimeout(async () => {
      timer = undefined;
      if (!running) return;

      if (!checking) {
        checking = true;
        try {
          const current = await readCurrent();
          if (
            typeof current === 'string'
            && current.trim().length > 0
            && current !== baseline
            && !changePending
          ) {
            changePending = true;
            onChanged(current);
          }
        } catch {
          // Reading local files can fail temporarily when the browser has not
          // granted file access. Keep the preview and try again next round.
        } finally {
          checking = false;
        }
      }

      schedule();
    }, Math.max(250, intervalMs));
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      schedule();
    },
    stop: () => {
      running = false;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
    setBaseline: (content: string) => {
      baseline = content;
      changePending = false;
    },
  };
}
