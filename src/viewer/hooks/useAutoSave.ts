import { useEffect, useRef, useState, useCallback } from 'react';

interface AutoSaveOptions {
  content: string;
  fileHandle: FileSystemFileHandle | null;
  enabled: boolean;
  onSave: (handle: FileSystemFileHandle, content: string) => Promise<void>;
  debounceMs?: number;
}

interface AutoSaveState {
  lastSaved: Date | null;
  isSaving: boolean;
  error: string | null;
}

export function useAutoSave({
  content,
  fileHandle,
  enabled,
  onSave,
  debounceMs = 2000,
}: AutoSaveOptions): AutoSaveState {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>(content);
  const isMountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Only auto-save when all conditions are met
    if (!enabled || !fileHandle || content === lastSavedContentRef.current) {
      clearTimer();
      return;
    }

    clearTimer();

    timerRef.current = setTimeout(() => {
      const performSave = async () => {
        if (!isMountedRef.current) return;

        setIsSaving(true);
        setError(null);

        try {
          await onSave(fileHandle, content);
          if (isMountedRef.current) {
            lastSavedContentRef.current = content;
            setLastSaved(new Date());
            setError(null);
          }
        } catch (err: unknown) {
          if (isMountedRef.current) {
            const message = err instanceof Error ? err.message : 'Auto-save failed';
            setError(message);
          }
        } finally {
          if (isMountedRef.current) {
            setIsSaving(false);
          }
        }
      };

      void performSave();
    }, debounceMs);

    return clearTimer;
  }, [content, fileHandle, enabled, onSave, debounceMs, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return { lastSaved, isSaving, error };
}
