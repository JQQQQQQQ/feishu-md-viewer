import { useEffect } from 'react';

const COLLAPSIBLE_HEADING_SELECTOR = 'h2, h3';
const TOGGLE_SELECTOR = 'button.feishu-editor-heading-toggle';
const HIDDEN_MARKER_ATTR = 'data-feishu-heading-hidden-by';
const COLLAPSE_MARKER_ATTR = 'data-feishu-collapse-marker';

function getHeadingLevel(element: Element): number | null {
  const match = /^H([1-6])$/.exec(element.tagName);
  if (match?.[1]) return Number(match[1]);

  const ariaLevel = element.getAttribute('aria-level');
  if (!ariaLevel) return null;

  const level = Number(ariaLevel);
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : null;
}

function collectSectionElements(heading: HTMLElement): HTMLElement[] {
  const level = getHeadingLevel(heading);
  if (level === null) return [];

  const elements: HTMLElement[] = [];
  let sibling = heading.nextElementSibling;

  while (sibling) {
    if (sibling instanceof HTMLElement) {
      const siblingLevel = getHeadingLevel(sibling);
      if (siblingLevel !== null && siblingLevel <= level) break;
      elements.push(sibling);
    }
    sibling = sibling.nextElementSibling;
  }

  return elements;
}

function getCollapseMarker(heading: HTMLElement): string {
  let marker = heading.getAttribute(COLLAPSE_MARKER_ATTR);
  if (!marker) {
    marker = `h-${Math.random().toString(36).slice(2, 10)}`;
    heading.setAttribute(COLLAPSE_MARKER_ATTR, marker);
  }
  return marker;
}

function updateHiddenMarker(element: HTMLElement, marker: string, hidden: boolean): void {
  const current = element.getAttribute(HIDDEN_MARKER_ATTR) ?? '';
  const markers = new Set(current.split(',').map((item) => item.trim()).filter(Boolean));

  if (hidden) {
    markers.add(marker);
  } else {
    markers.delete(marker);
  }

  if (markers.size === 0) {
    element.removeAttribute(HIDDEN_MARKER_ATTR);
    return;
  }

  element.setAttribute(HIDDEN_MARKER_ATTR, Array.from(markers).join(','));
}

function applyCollapsedState(heading: HTMLElement, collapsed: boolean): void {
  const sectionElements = collectSectionElements(heading);
  const marker = getCollapseMarker(heading);
  sectionElements.forEach((element) => {
    updateHiddenMarker(element, marker, collapsed);
  });
}

function ensureToggleButton(heading: HTMLElement): HTMLButtonElement {
  const existing = heading.querySelector<HTMLButtonElement>(`:scope > ${TOGGLE_SELECTOR}`);
  if (existing) return existing;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'feishu-editor-heading-toggle feishu-editor-heading-toggle--expanded';
  button.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3L11 8L5 13Z"></path></svg>';
  heading.prepend(button);
  return button;
}

function syncToggleButton(heading: HTMLElement): void {
  const button = ensureToggleButton(heading);
  const collapsed = heading.dataset.feishuCollapsed === 'true';

  button.classList.toggle('feishu-editor-heading-toggle--expanded', !collapsed);
  button.setAttribute('aria-label', collapsed ? '展开' : '折叠');
  button.setAttribute('aria-expanded', String(!collapsed));
  heading.setAttribute('data-feishu-collapsible', 'true');

  applyCollapsedState(heading, collapsed);
}

function cleanupEditorCollapse(editor: HTMLElement): void {
  editor.querySelectorAll<HTMLButtonElement>(TOGGLE_SELECTOR).forEach((button) => button.remove());
  editor.querySelectorAll<HTMLElement>(COLLAPSIBLE_HEADING_SELECTOR).forEach((heading) => {
    heading.removeAttribute('data-feishu-collapsible');
    heading.removeAttribute('data-feishu-collapsed');
    heading.removeAttribute(COLLAPSE_MARKER_ATTR);
  });
  editor.querySelectorAll<HTMLElement>(`[${HIDDEN_MARKER_ATTR}]`).forEach((element) => {
    element.removeAttribute(HIDDEN_MARKER_ATTR);
  });
}

export function useEditorHeadingCollapse(container: HTMLElement | null, enabled: boolean): void {
  useEffect(() => {
    if (!container) return;
    let activeEditor: HTMLElement | null = null;
    let editorObserver: MutationObserver | null = null;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest(TOGGLE_SELECTOR) as HTMLButtonElement | null;
      if (!button) return;

      const heading = button.closest('h2, h3') as HTMLElement | null;
      if (!heading) return;

      event.preventDefault();
      event.stopPropagation();

      const nextCollapsed = heading.dataset.feishuCollapsed !== 'true';
      heading.dataset.feishuCollapsed = nextCollapsed ? 'true' : 'false';
      activeEditor?.querySelectorAll<HTMLElement>(COLLAPSIBLE_HEADING_SELECTOR).forEach(syncToggleButton);
    };

    const detachEditor = () => {
      editorObserver?.disconnect();
      editorObserver = null;
      if (activeEditor) {
        activeEditor.removeEventListener('click', handleClick);
        cleanupEditorCollapse(activeEditor);
      }
      activeEditor = null;
    };

    const attachEditor = (editor: HTMLElement) => {
      if (activeEditor === editor) return;
      detachEditor();

      if (!enabled) {
        cleanupEditorCollapse(editor);
        return;
      }

      activeEditor = editor;
      editor.querySelectorAll<HTMLElement>(COLLAPSIBLE_HEADING_SELECTOR).forEach(syncToggleButton);
      editor.addEventListener('click', handleClick);

      editorObserver = new MutationObserver(() => {
        activeEditor?.querySelectorAll<HTMLElement>(COLLAPSIBLE_HEADING_SELECTOR).forEach(syncToggleButton);
      });

      editorObserver.observe(editor, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    };

    const syncEditor = () => {
      const editor = container.querySelector('.ProseMirror') as HTMLElement | null;
      if (!editor) {
        detachEditor();
        return;
      }
      attachEditor(editor);
    };

    syncEditor();

    const containerObserver = new MutationObserver(syncEditor);
    containerObserver.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => {
      containerObserver.disconnect();
      detachEditor();
    };
  }, [container, enabled]);
}
