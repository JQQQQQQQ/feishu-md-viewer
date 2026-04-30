import { useState, useCallback, useEffect, useRef } from 'react';
import { useViewerStore } from '../../store';
import { SplitPane } from '../Common/SplitPane';
import { MarkdownRenderer } from './MarkdownRenderer';

const DEBOUNCE_DELAY = 300;

export function MarkdownEditor() {
  const content = useViewerStore((s) => s.content);
  const setContent = useViewerStore((s) => s.setContent);
  const undo = useViewerStore((s) => s.undo);
  const redo = useViewerStore((s) => s.redo);

  const [localValue, setLocalValue] = useState(content);
  const [previewContent, setPreviewContent] = useState(content);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync local value when store content changes externally (undo/redo)
  useEffect(() => {
    // Clear any pending debounce to prevent it from overwriting undo/redo state
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    setLocalValue(content);
    setPreviewContent(content);
  }, [content]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        setContent(newValue);
        setPreviewContent(newValue);
      }, DEBOUNCE_DELAY);
    },
    [setContent],
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (isMod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo]);

  const editorPanel = (
    <div className="md-editor__textarea-wrapper">
      <label htmlFor="md-editor-textarea" className="md-editor__label">
        Markdown Source
      </label>
      <textarea
        id="md-editor-textarea"
        ref={textareaRef}
        className="md-editor__textarea"
        value={localValue}
        onChange={handleChange}
        spellCheck={false}
        aria-label="Markdown editor"
      />
    </div>
  );

  const previewPanel = (
    <div className="md-editor__preview">
      <div className="md-editor__preview-label">Preview</div>
      <div className="md-editor__preview-content">
        <MarkdownRenderer content={previewContent} />
      </div>
    </div>
  );

  return (
    <div className="md-editor">
      <SplitPane left={editorPanel} right={previewPanel} />
    </div>
  );
}
