import { useState, useCallback, type ReactNode } from 'react';
import { MermaidEditor } from './MermaidEditor';
import { useViewerStore } from '../../store';

interface MermaidToolbarProps {
  code: string;
  blockIndex: number;
  children: ReactNode;
}

export function MermaidToolbar({ code, blockIndex, children }: MermaidToolbarProps) {
  const mode = useViewerStore((s) => s.mode);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handleEdit = useCallback(() => {
    setIsEditorOpen(true);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
  }, []);

  // Only show toolbar in edit mode
  if (mode !== 'edit') {
    return <>{children}</>;
  }

  return (
    <div className="mermaid-toolbar-wrapper">
      <div className="mermaid-toolbar">
        <button
          className="mermaid-toolbar__edit-btn"
          onClick={handleEdit}
          type="button"
          aria-label="Edit Mermaid diagram"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10.5 1.75L12.25 3.5M1.75 12.25L2.333 9.917L10.083 2.167L11.833 3.917L4.083 11.667L1.75 12.25Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Edit
        </button>
      </div>
      {children}
      {isEditorOpen && (
        <MermaidEditor
          code={code}
          blockIndex={blockIndex}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  );
}
