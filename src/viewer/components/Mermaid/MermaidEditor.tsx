import { useState, useCallback, useEffect, useRef } from 'react';
import { useViewerStore } from '../../store';
import { SplitPane } from '../Common/SplitPane';
import { MermaidBlock } from '../Markdown/MermaidBlock';
import { replaceMermaidBlock } from '../../utils/mermaid-writeback';

interface MermaidEditorProps {
  code: string;
  blockIndex: number;
  onClose: () => void;
}

const DEBOUNCE_DELAY = 300;

export function MermaidEditor({ code, blockIndex, onClose }: MermaidEditorProps) {
  const content = useViewerStore((s) => s.content);
  const setContent = useViewerStore((s) => s.setContent);

  const [localCode, setLocalCode] = useState(code);
  const [previewCode, setPreviewCode] = useState(code);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalCode(newValue);
    setError(null);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      setPreviewCode(newValue);
    }, DEBOUNCE_DELAY);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleApply = useCallback(() => {
    const trimmedCode = localCode.trim();
    if (!trimmedCode) {
      setError('Mermaid code cannot be empty');
      return;
    }

    const updatedContent = replaceMermaidBlock(content, blockIndex, trimmedCode);
    setContent(updatedContent);
    onClose();
  }, [localCode, content, blockIndex, setContent, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // Escape key closes editor
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const editorPanel = (
    <div className="mermaid-editor__textarea-wrapper">
      <label htmlFor="mermaid-editor-textarea" className="mermaid-editor__label">
        Mermaid Code
      </label>
      <textarea
        id="mermaid-editor-textarea"
        className="mermaid-editor__textarea"
        value={localCode}
        onChange={handleChange}
        spellCheck={false}
        aria-label="Mermaid code editor"
      />
      {error && (
        <div className="mermaid-editor__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );

  const previewPanel = (
    <div className="mermaid-editor__preview">
      <div className="mermaid-editor__preview-label">Preview</div>
      <div className="mermaid-editor__preview-content">
        <MermaidBlock code={previewCode} index={blockIndex} />
      </div>
    </div>
  );

  return (
    <div className="mermaid-editor__overlay" role="dialog" aria-label="Mermaid diagram editor">
      <div className="mermaid-editor__container">
        <div className="mermaid-editor__toolbar">
          <span className="mermaid-editor__toolbar-title">Edit Mermaid Diagram</span>
          <div className="mermaid-editor__toolbar-actions">
            <button
              className="mermaid-editor__btn mermaid-editor__btn--cancel"
              onClick={handleCancel}
              type="button"
            >
              Cancel
            </button>
            <button
              className="mermaid-editor__btn mermaid-editor__btn--apply"
              onClick={handleApply}
              type="button"
            >
              Apply
            </button>
          </div>
        </div>
        <div className="mermaid-editor__body">
          <SplitPane left={editorPanel} right={previewPanel} />
        </div>
      </div>
    </div>
  );
}
