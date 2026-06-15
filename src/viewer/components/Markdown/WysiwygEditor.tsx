import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/core';
import { Selection } from '@milkdown/prose/state';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { useEditor, Milkdown, MilkdownProvider } from '@milkdown/react';
import { insert } from '@milkdown/utils';
import { useViewerStore } from '../../store';
import { notifyModeChangeStart } from '../../hooks/useModeScrollRestore';
import { BlockInsertMenu } from './BlockInsertMenu';
import { FloatingToolbar } from './FloatingToolbar';
import { TableOperations } from './TableControls/TableOperations';
import { TableHandles } from './TableHandles';
import { CodeLanguageSelector } from './CodeLanguageSelector';
import { CalloutTypeSelector } from './CalloutTypeSelector';
import { MermaidPreviewModal } from '../Mermaid/MermaidPreviewModal';
import { editorCodeHighlightPlugin } from './Editor/editorCodeHighlightPlugin';
import { MERMAID_PREVIEW_EVENT } from './Editor/editorMermaidWidget';
import { useEditorDocumentPresentation } from './Editor/useEditorDocumentPresentation';
import { useEditorSectionDepthStyles } from './Editor/useEditorSectionDepthStyles';
import { useEditorTableLayoutStyles } from './Editor/useEditorTableLayoutStyles';
import { useEditorTableSelection } from './Editor/useEditorTableSelection';
import { useEditorHeadingCollapse } from './Editor/useEditorHeadingCollapse';

const DEBOUNCE_DELAY = 300;

interface MilkdownEditorProps {
  content: string;
  editable: boolean;
}

function shouldActivateFromTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return !target.closest('button, input, textarea, select, a, [role="button"], .feishu-block-menu, .feishu-floating-toolbar');
}

function MilkdownEditor({ content, editable }: MilkdownEditorProps) {
  const setContent = useViewerStore((s) => s.setContent);
  const setMode = useViewerStore((s) => s.setMode);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const [editorContainer, setEditorContainer] = useState<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorInstanceRef = useRef<Editor | undefined>(undefined);
  const editableRef = useRef(editable);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  useEditorDocumentPresentation(editorContainer);
  useEditorSectionDepthStyles(editorContainer);
  useEditorTableLayoutStyles(editorContainer);
  useEditorTableSelection(editorContainer, true);
  useEditorHeadingCollapse(editorContainer, !editable);

  const handleEditorContainerRef = useCallback((node: HTMLDivElement | null) => {
    editorContainerRef.current = node;
    setEditorContainer(node);
  }, []);

  const { get, loading } = useEditor((root) => {
    const editorInstance = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, content);
        ctx.set(editorViewOptionsCtx, {
          editable: () => editableRef.current,
        });
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          debounceRef.current = setTimeout(() => {
            setContent(markdown);
          }, DEBOUNCE_DELAY);
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(editorCodeHighlightPlugin)
      .use(listener);

    return editorInstance;
  }, []);

  // Store the editor instance once loading completes
  if (!loading) {
    const instance = get();
    if (instance) {
      editorInstanceRef.current = instance;
    }
  }

  useEffect(() => {
    editableRef.current = editable;
    const editor = editorInstanceRef.current;
    if (!editor) return;

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.setProps({ editable: () => editableRef.current });
    });
  }, [editable]);

  useEffect(() => {
    const handleOpenPreview = (event: Event) => {
      const svg = (event as CustomEvent<{ svg?: string }>).detail?.svg;
      if (svg) setPreviewSvg(svg);
    };

    window.addEventListener(MERMAID_PREVIEW_EVENT, handleOpenPreview);
    return () => window.removeEventListener(MERMAID_PREVIEW_EVENT, handleOpenPreview);
  }, []);

  const activateEditorOnDoubleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (editable || event.button !== 0 || !shouldActivateFromTarget(event.target)) return;

    const editor = editorInstanceRef.current;
    if (!editor) return;

    event.preventDefault();
    notifyModeChangeStart();
    editableRef.current = true;

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.setProps({ editable: () => true });
      const position = view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (position) {
        view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(position.pos))));
      }
      view.focus();
    });
    setMode('edit');
  }, [editable, setMode]);

  const handleInsert = useCallback(
    (markdownSnippet: string) => {
      const editor = editorInstanceRef.current;
      if (!editor) {
        // Fallback: append to store content directly
        const current = useViewerStore.getState().content || '';
        setContent(current + markdownSnippet);
        return;
      }
      // Refocus the editor before inserting
      const editorEl = editorContainerRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
      if (editorEl) {
        editorEl.focus();
      }
      // Small delay to ensure focus is established
      setTimeout(() => {
        try {
          editor.action(insert(markdownSnippet));
        } catch {
          // Fallback if insert action fails
          const current = useViewerStore.getState().content || '';
          setContent(current + markdownSnippet);
        }
      }, 50);
    },
    [setContent],
  );

  return (
    <div
      className="feishu-wysiwyg"
      data-editable={editable ? 'true' : 'false'}
      ref={handleEditorContainerRef}
      onDoubleClickCapture={activateEditorOnDoubleClick}
    >
      <div className="feishu-wysiwyg__editor" style={{ position: 'relative' }}>
        <Milkdown />
        {editable && (
          <>
            <FloatingToolbar />
            <TableOperations />
            <TableHandles />
            <CodeLanguageSelector />
            <CalloutTypeSelector />
          </>
        )}
      </div>
      {editable && (
        <BlockInsertMenu
          editorContainerRef={editorContainerRef}
          onInsert={handleInsert}
        />
      )}
      {previewSvg && (
        <MermaidPreviewModal
          svg={previewSvg}
          onClose={() => setPreviewSvg(null)}
        />
      )}
    </div>
  );
}

export function WysiwygEditor({ content, editable }: MilkdownEditorProps) {
  return (
    <MilkdownProvider>
      <MilkdownEditor content={content} editable={editable} />
    </MilkdownProvider>
  );
}
