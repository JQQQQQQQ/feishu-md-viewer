import { useEffect } from 'react';

const MAX_DEPTH = 6;
const STYLE_ID = 'feishu-editor-section-depth-styles';

const DEPTH_OFFSETS: Record<number, number> = {
  2: 28,
  3: 48,
  4: 68,
  5: 84,
  6: 84,
};

function getHeadingLevel(element: Element): number | null {
  const match = /^H([1-6])$/.exec(element.tagName);
  return match ? Number(match[1]) : null;
}

function getHeadingDepth(level: number): number {
  if (level <= 2) return 0;
  return Math.min(level - 1, MAX_DEPTH);
}

function getDepthOffset(depth: number): number {
  return DEPTH_OFFSETS[Math.min(depth, MAX_DEPTH)] ?? 0;
}

function getOrCreateStyle(root: ParentNode): HTMLStyleElement {
  const existing = root.querySelector(`#${STYLE_ID}`) as HTMLStyleElement | null;
  if (existing) return existing;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  const target = root instanceof ShadowRoot ? root : document.head;
  target.appendChild(style);
  return style;
}

function buildDepthRules(editor: HTMLElement) {
  const rules: string[] = [];
  let activeDepth = 0;

  Array.from(editor.children).forEach((child, index) => {
    const headingLevel = getHeadingLevel(child);
    let depth = activeDepth;

    if (headingLevel !== null) {
      depth = getHeadingDepth(headingLevel);
      activeDepth = headingLevel <= 1 ? 0 : headingLevel;
    }

    if (depth < 2) return;

    const offset = getDepthOffset(depth);
    if (offset <= 0) return;

    const selector = `.feishu-wysiwyg__editor .ProseMirror > :nth-child(${index + 1})`;
    if (child.tagName === 'TABLE') {
      rules.push(`${selector}{max-width:min(1320px,calc(100vw - 96px));margin-left:${offset}px!important;}`);
      return;
    }

    rules.push(`${selector}{max-width:calc(100% - ${offset}px);margin-left:${offset}px!important;}`);
  });

  return rules.join('\n');
}

export function useEditorSectionDepthStyles(container: HTMLElement | null) {
  useEffect(() => {
    if (!container) return;

    const root = container.getRootNode() as ParentNode;
    const style = getOrCreateStyle(root);
    let frame = 0;

    const updateStyles = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const editor = container.querySelector('.ProseMirror') as HTMLElement | null;
        style.textContent = editor ? buildDepthRules(editor) : '';
      });
    };

    updateStyles();

    const observer = new MutationObserver(updateStyles);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      style.textContent = '';
    };
  }, [container]);
}
