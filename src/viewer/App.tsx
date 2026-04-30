import { useEffect, useMemo, useCallback } from 'react';
import { type PageSource } from '../content/detector';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { type SaveStatusState } from './components/Common/SaveStatus';
import { MarkdownRenderer } from './components/Markdown/MarkdownRenderer';
import { MarkdownEditor } from './components/Markdown/MarkdownEditor';
import { AppShell } from './components/Layout/AppShell';
import { useTOC } from './hooks/useTOC';
import { useFileAccess } from './hooks/useFileAccess';
import { useAutoSave } from './hooks/useAutoSave';
import { useBeforeUnload } from './hooks/useBeforeUnload';
import { useViewerStore } from './store';

const HANDLE_STORAGE_KEY = 'current-document-handle';

interface AppProps {
  markdown: string;
  source: PageSource;
}

function extractTitle(markdown: string): string {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.trim() ?? '';
}

export function App({ markdown, source }: AppProps) {
  const initDocument = useViewerStore((s) => s.initDocument);
  const content = useViewerStore((s) => s.content);
  const mode = useViewerStore((s) => s.mode);
  const isDirty = useViewerStore((s) => s.isDirty);

  // File system access
  const {
    fileHandle,
    error: fileError,
    isSupported,
    requestFileHandle,
    saveToHandle,
    downloadFallback,
    restoreHandle,
    persistHandle,
    setFileHandle,
  } = useFileAccess();

  // Initialize the store with the markdown content
  useEffect(() => {
    initDocument(markdown);
  }, [markdown, initDocument]);

  // Attempt to restore previously saved file handle
  useEffect(() => {
    void restoreHandle(HANDLE_STORAGE_KEY);
  }, [restoreHandle]);

  // Save callback
  const handleSave = useCallback(async () => {
    const currentContent = useViewerStore.getState().content;
    if (!currentContent) return;

    if (!isSupported) {
      downloadFallback(currentContent);
      return;
    }

    let handle = fileHandle;

    if (!handle) {
      // First save — prompt file picker
      handle = await requestFileHandle();
      if (!handle) return; // User cancelled
      setFileHandle(handle);
      await persistHandle(HANDLE_STORAGE_KEY, handle);
    }

    await saveToHandle(handle, currentContent);
  }, [
    fileHandle,
    isSupported,
    requestFileHandle,
    saveToHandle,
    downloadFallback,
    persistHandle,
    setFileHandle,
  ]);

  // Auto-save (only in edit mode with a handle)
  const autoSave = useAutoSave({
    content: content || '',
    fileHandle,
    enabled: mode === 'edit' && isDirty && fileHandle !== null,
    onSave: saveToHandle,
  });

  // Guard against accidental tab close with unsaved changes
  useBeforeUnload(isDirty);

  // Keyboard shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        void handleSave();
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [handleSave]);

  const tocItems = useTOC(content || markdown);
  const title = useMemo(() => extractTitle(content || markdown), [content, markdown]);

  const displayContent = content || markdown;

  // Derive save status for the UI
  const saveStatus: SaveStatusState = (() => {
    if (autoSave.error || fileError) return 'error';
    if (autoSave.isSaving) return 'saving';
    if (isDirty) return 'unsaved';
    return 'saved';
  })();

  const saveErrorMessage = autoSave.error || fileError;

  return (
    <ErrorBoundary>
      <div
        className="feishu-viewer"
        role="article"
        aria-label="Rendered markdown document"
        data-source={source}
      >
        <AppShell
          title={title}
          tocItems={tocItems}
          onSave={handleSave}
          saveStatus={saveStatus}
          saveError={saveErrorMessage}
          lastSaved={autoSave.lastSaved}
          showSaveControls={mode === 'edit'}
        >
          {mode === 'edit' ? (
            <div className="feishu-viewer__page feishu-viewer__page--editor">
              <MarkdownEditor />
            </div>
          ) : (
            <div className="feishu-viewer__page">
              <div className="feishu-viewer__content">
                <MarkdownRenderer content={displayContent} />
              </div>
            </div>
          )}
        </AppShell>
      </div>
    </ErrorBoundary>
  );
}
