import { useEffect } from 'react';
import { createUniqueHeadingIdFactory } from '../../../utils/heading-slug';

type CalloutType = 'note' | 'tip' | 'warning' | 'important' | 'caution';

const CALLOUT_TITLES: Record<CalloutType, string> = {
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
  important: 'Important',
  caution: 'Caution',
};

const CALLOUT_ICONS: Record<CalloutType, string> = {
  note: 'i',
  tip: '!',
  warning: '!',
  important: '*',
  caution: '!!',
};

const STYLE_ID = 'feishu-editor-document-presentation-styles';

const CALLOUT_COLORS: Record<CalloutType, {
  bg: string;
  bgEnd: string;
  border: string;
  accent: string;
  title: string;
}> = {
  note: {
    bg: '#f0f5ff',
    bgEnd: 'rgba(240, 245, 255, 0.32)',
    border: '#bacefd',
    accent: '#3370ff',
    title: '#1f4fd6',
  },
  tip: {
    bg: '#effbf3',
    bgEnd: 'rgba(239, 251, 243, 0.34)',
    border: '#b7ebc6',
    accent: '#2da44e',
    title: '#1f7a3d',
  },
  warning: {
    bg: '#fff8e6',
    bgEnd: 'rgba(255, 248, 230, 0.38)',
    border: '#f6d48f',
    accent: '#d68a00',
    title: '#9a6700',
  },
  important: {
    bg: '#f7f1ff',
    bgEnd: 'rgba(247, 241, 255, 0.36)',
    border: '#d8c2ff',
    accent: '#7c3aed',
    title: '#5f2bbd',
  },
  caution: {
    bg: '#fff1f0',
    bgEnd: 'rgba(255, 241, 240, 0.36)',
    border: '#ffccc7',
    accent: '#d92d20',
    title: '#a11d16',
  },
};

function getCalloutType(text: string | null | undefined): CalloutType | null {
  const match = text?.match(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i);
  const type = match?.[1];
  return type ? (type.toLowerCase() as CalloutType) : null;
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

function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getCalloutRule(selector: string, type: CalloutType): string {
  const colors = CALLOUT_COLORS[type];
  return `
${selector}{
  --feishu-callout-bg:${colors.bg};
  --feishu-callout-bg-end:${colors.bgEnd};
  --feishu-callout-border:${colors.border};
  --feishu-callout-accent:${colors.accent};
  --feishu-callout-title:${colors.title};
  position:relative;
  padding:46px 18px 16px;
  background:linear-gradient(135deg,var(--feishu-callout-bg),var(--feishu-callout-bg-end)),var(--feishu-bg-content);
  border-color:var(--feishu-callout-border);
  border-left-color:var(--feishu-callout-accent);
  box-shadow:0 1px 2px rgba(31,35,41,.04),inset 0 1px 0 rgba(255,255,255,.72);
}
${selector}::before{
  content:'${CALLOUT_TITLES[type]}';
  position:absolute;
  top:15px;
  left:48px;
  color:var(--feishu-callout-title);
  font-size:var(--feishu-font-size-small);
  font-weight:650;
  line-height:1.35;
}
${selector}::after{
  content:'${CALLOUT_ICONS[type]}';
  position:absolute;
  top:12px;
  left:18px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:22px;
  height:22px;
  border:1px solid rgba(255,255,255,.84);
  border-radius:999px;
  background:rgba(255,255,255,.72);
  color:var(--feishu-callout-accent);
  font-family:var(--feishu-font-family);
  font-size:11px;
  font-weight:700;
  box-shadow:0 1px 2px rgba(31,35,41,.06);
}`;
}

function buildPresentationRules(editor: HTMLElement): string {
  const rules: string[] = [];

  Array.from(editor.children).forEach((child, index) => {
    const selector = `.feishu-wysiwyg__editor .ProseMirror > :nth-child(${index + 1})`;

    if (child.tagName === 'PRE') {
      const language = (child as HTMLElement).dataset.language?.trim();
      if (language) {
        rules.push(`${selector}::before{content:'${escapeCssString(language)}';}`);
      }
      return;
    }

    if (child.tagName === 'BLOCKQUOTE') {
      const firstParagraph = child.querySelector('p');
      const calloutType = getCalloutType(firstParagraph?.textContent);
      if (calloutType) rules.push(getCalloutRule(selector, calloutType));
    }
  });

  return rules.join('\n');
}

function normalizeHeadings(editor: HTMLElement): void {
  const getUniqueId = createUniqueHeadingIdFactory();
  const headings = editor.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6');

  headings.forEach((heading) => {
    const text = heading.textContent?.trim() ?? '';
    const id = getUniqueId(text);
    const level = Number(heading.tagName.slice(1));

    if (id) {
      heading.id = id;
    }

    heading.classList.add('feishu-heading');
    for (let idx = 1; idx <= 6; idx += 1) {
      heading.classList.remove(`feishu-h${idx}`);
    }
    if (Number.isInteger(level) && level >= 1 && level <= 6) {
      heading.classList.add(`feishu-h${level}`);
    }
  });
}

export function useEditorDocumentPresentation(container: HTMLElement | null) {
  useEffect(() => {
    if (!container) return;

    const root = container.getRootNode() as ParentNode;
    const style = getOrCreateStyle(root);
    let frame = 0;

    const updatePresentation = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const editor = container.querySelector('.ProseMirror') as HTMLElement | null;
        if (!editor) {
          style.textContent = '';
          return;
        }

        normalizeHeadings(editor);
        style.textContent = buildPresentationRules(editor);
      });
    };

    updatePresentation();

    const observer = new MutationObserver(updatePresentation);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-language'],
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      style.textContent = '';
    };
  }, [container]);
}
