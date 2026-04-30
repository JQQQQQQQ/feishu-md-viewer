import { useCallback, useRef } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { useEditor, Milkdown, MilkdownProvider } from '@milkdown/react';
import { insert } from '@milkdown/utils';
import { useViewerStore } from '../../store';
import { BlockInsertMenu } from './BlockInsertMenu';

const DEBOUNCE_DELAY = 300;

function MilkdownEditor() {
  const content = useViewerStore((s) => s.content) || '';
  const setContent = useViewerStore((s) => s.setContent);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorInstanceRef = useRef<Editor | undefined>(undefined);

  const { get, loading } = useEditor((root) => {
    const editorInstance = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, content);
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

  const handleInsert = useCallback(
    (markdownSnippet: string) => {
      const editor = editorInstanceRef.current;
      if (!editor) return;
      editor.action(insert(markdownSnippet));
    },
    [],
  );

  return (
    <div className="feishu-wysiwyg" ref={editorContainerRef}>
      <div className="feishu-wysiwyg__editor">
        <Milkdown />
      </div>
      <BlockInsertMenu
        editorContainerRef={editorContainerRef}
        onInsert={handleInsert}
      />
    </div>
  );
}

export function WysiwygEditor() {
  return (
    <MilkdownProvider>
      <MilkdownEditor />
    </MilkdownProvider>
  );
}
