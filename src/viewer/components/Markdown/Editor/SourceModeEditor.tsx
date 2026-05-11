import { useCallback, useEffect, useRef, useState } from 'react';
import { useViewerStore } from '../../../store';

const DEBOUNCE_DELAY = 250;

interface SourceModeEditorProps {
  content: string;
}

export function SourceModeEditor({ content }: SourceModeEditorProps) {
  const setContent = useViewerStore((s) => s.setContent);
  const [localValue, setLocalValue] = useState(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(content);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    latestValueRef.current = content;
    setLocalValue(content);
  }, [content]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (latestValueRef.current !== useViewerStore.getState().content) {
        setContent(latestValueRef.current);
      }
    };
  }, [setContent]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    latestValueRef.current = nextValue;
    setLocalValue(nextValue);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setContent(nextValue);
    }, DEBOUNCE_DELAY);
  }, [setContent]);

  return (
    <div className="md-editor md-editor--source">
      <label htmlFor="md-source-editor" className="md-editor__label">
        Markdown 源码
      </label>
      <textarea
        id="md-source-editor"
        className="md-editor__textarea"
        value={localValue}
        onChange={handleChange}
        spellCheck={false}
        aria-label="Markdown 源码编辑器"
      />
    </div>
  );
}
