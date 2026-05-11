import { useEffect } from 'react';
import { getTableLayoutMode, type TableLayoutMode } from '../FeishuTableLayout';

const STYLE_ID = 'feishu-editor-table-layout-styles';
const VIEWPORT_GUTTER = 48;
const MAX_WIDE_TABLE_WIDTH = 1320;

function getOrCreateStyle(root: ParentNode): HTMLStyleElement {
  const existing = root.querySelector(`#${STYLE_ID}`) as HTMLStyleElement | null;
  if (existing) return existing;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  const target = root instanceof ShadowRoot ? root : document.head;
  target.appendChild(style);
  return style;
}

function getHeadingLevel(element: Element): number | null {
  const match = /^H([1-6])$/.exec(element.tagName);
  return match ? Number(match[1]) : null;
}

function getDepthOffset(depth: number): number {
  switch (depth) {
    case 2:
      return 28;
    case 3:
      return 48;
    case 4:
      return 68;
    case 5:
    case 6:
      return 84;
    default:
      return 0;
  }
}

function getEditorTableOffset(table: HTMLTableElement): number {
  let activeDepth = 0;
  const parent = table.parentElement;
  if (!parent) return 0;

  for (const child of Array.from(parent.children)) {
    if (child === table) break;

    const headingLevel = getHeadingLevel(child);
    if (headingLevel === null) continue;

    activeDepth = headingLevel <= 1 ? 0 : headingLevel;
  }

  return getDepthOffset(activeDepth);
}

function getViewportBounds(table: HTMLTableElement) {
  const main = table.closest('.feishu-app-shell__main');
  const mainLeft = main instanceof HTMLElement ? main.getBoundingClientRect().left : 0;
  const left = mainLeft + VIEWPORT_GUTTER;
  const right = window.innerWidth - VIEWPORT_GUTTER;

  return {
    left,
    width: Math.max(0, right - left),
  };
}

function getWideTableRule(selector: string, table: HTMLTableElement, mode: TableLayoutMode, depthOffset: number): string {
  const editor = table.closest('.ProseMirror') as HTMLElement | null;
  const editorRect = editor?.getBoundingClientRect();
  const baseWidth = Math.max(1, (editorRect?.width ?? table.getBoundingClientRect().width) - depthOffset);
  const baseLeft = (editorRect?.left ?? table.getBoundingClientRect().left) + depthOffset;
  const bounds = getViewportBounds(table);
  const rightWidth = bounds.left + bounds.width - baseLeft;
  const wideWidth = Math.round(Math.min(
    MAX_WIDE_TABLE_WIDTH,
    Math.max(baseWidth, mode === 'right' ? rightWidth : bounds.width),
  ));
  const balancedOffset = mode === 'balanced'
    ? Math.round(bounds.left + (bounds.width - wideWidth) / 2 - baseLeft)
    : 0;
  const marginLeft = Math.round(depthOffset + balancedOffset);

  return `${selector}{display:table;margin-left:${marginLeft}px!important;width:${wideWidth}px;min-width:${wideWidth}px;max-width:${wideWidth}px;}`;
}

function getNormalTableRule(selector: string, depthOffset: number): string {
  if (depthOffset <= 0) {
    return `${selector}{display:table;margin-left:0!important;width:100%;min-width:100%;max-width:100%;}`;
  }

  return `${selector}{display:table;margin-left:${depthOffset}px!important;width:calc(100% - ${depthOffset}px);min-width:calc(100% - ${depthOffset}px);max-width:calc(100% - ${depthOffset}px);}`;
}

function buildTableLayoutRules(editor: HTMLElement): string {
  const rules: string[] = [];

  Array.from(editor.children).forEach((child, index) => {
    if (!(child instanceof HTMLTableElement)) return;

    const selector = `.feishu-wysiwyg__editor .ProseMirror > :nth-child(${index + 1})`;
    const depthOffset = getEditorTableOffset(child);
    const mode = getTableLayoutMode(child);
    rules.push(mode === 'normal'
      ? getNormalTableRule(selector, depthOffset)
      : getWideTableRule(selector, child, mode, depthOffset));
  });

  return rules.join('\n');
}

export function useEditorTableLayoutStyles(container: HTMLElement | null) {
  useEffect(() => {
    if (!container) return;

    const root = container.getRootNode() as ParentNode;
    const style = getOrCreateStyle(root);
    let frame = 0;

    const updateStyles = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const editor = container.querySelector('.ProseMirror') as HTMLElement | null;
        style.textContent = editor ? buildTableLayoutRules(editor) : '';
      });
    };

    updateStyles();
    window.addEventListener('resize', updateStyles);

    const observer = new MutationObserver(updateStyles);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style'],
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateStyles);
      observer.disconnect();
      style.textContent = '';
    };
  }, [container]);
}
