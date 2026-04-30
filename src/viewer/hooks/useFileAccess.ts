import { useCallback, useState } from 'react';
import { saveFileHandle, getFileHandle } from '@/shared/utils/indexeddb';

interface FileAccessState {
  fileHandle: FileSystemFileHandle | null;
  error: string | null;
  isSupported: boolean;
}

interface FileAccessActions {
  requestFileHandle: () => Promise<FileSystemFileHandle | null>;
  saveToHandle: (handle: FileSystemFileHandle, content: string) => Promise<void>;
  downloadFallback: (content: string, filename?: string) => void;
  restoreHandle: (key: string) => Promise<FileSystemFileHandle | null>;
  persistHandle: (key: string, handle: FileSystemFileHandle) => Promise<void>;
  setFileHandle: (handle: FileSystemFileHandle | null) => void;
  clearError: () => void;
}

export type UseFileAccessReturn = FileAccessState & FileAccessActions;

export function isFileAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'showSaveFilePicker' in window &&
    typeof window.showSaveFilePicker === 'function'
  );
}

export function useFileAccess(): UseFileAccessReturn {
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSupported = isFileAccessSupported();

  const requestFileHandle = useCallback(async (): Promise<FileSystemFileHandle | null> => {
    if (!isSupported) {
      setError('File System Access API is not supported in this browser');
      return null;
    }

    try {
      const handle = await window.showSaveFilePicker({
        types: [
          {
            description: 'Markdown files',
            accept: { 'text/markdown': ['.md', '.markdown'] },
          },
        ],
        suggestedName: 'document.md',
      });
      setFileHandle(handle);
      setError(null);
      return handle;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled the picker — not an error
        return null;
      }
      const message = err instanceof Error ? err.message : 'Failed to open file picker';
      setError(message);
      return null;
    }
  }, [isSupported]);

  const saveToHandle = useCallback(
    async (handle: FileSystemFileHandle, content: string): Promise<void> => {
      try {
        const writable = await handle.createWritable();
        try {
          await writable.write(content);
          await writable.close();
          setError(null);
        } catch (writeErr: unknown) {
          // Attempt to close the writable even if write fails
          try {
            await writable.close();
          } catch {
            // Ignore close error
          }
          throw writeErr;
        }
      } catch (err: unknown) {
        if (err instanceof DOMException) {
          switch (err.name) {
            case 'NotAllowedError':
              setError('Permission denied. Please allow file access and try again.');
              break;
            case 'NoModificationAllowedError':
              setError('File is locked or read-only.');
              break;
            case 'QuotaExceededError':
              setError('Disk is full. Free up space and try again.');
              break;
            default:
              setError(`Save failed: ${err.message}`);
          }
        } else {
          const message = err instanceof Error ? err.message : 'Unknown error while saving';
          setError(message);
        }
        throw err;
      }
    },
    []
  );

  const downloadFallback = useCallback((content: string, filename = 'document.md'): void => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    }, 100);
  }, []);

  const restoreHandle = useCallback(
    async (key: string): Promise<FileSystemFileHandle | null> => {
      if (!isSupported) return null;
      try {
        const handle = await getFileHandle(key);
        if (handle) {
          // Verify permission
          const permission = await handle.queryPermission({ mode: 'readwrite' });
          if (permission === 'granted') {
            setFileHandle(handle);
            return handle;
          }
        }
        return null;
      } catch {
        return null;
      }
    },
    [isSupported]
  );

  const persistHandle = useCallback(
    async (key: string, handle: FileSystemFileHandle): Promise<void> => {
      try {
        await saveFileHandle(key, handle);
      } catch {
        // Non-critical — handle persistence failure silently
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    fileHandle,
    error,
    isSupported,
    requestFileHandle,
    saveToHandle,
    downloadFallback,
    restoreHandle,
    persistHandle,
    setFileHandle,
    clearError,
  };
}
