import { Plugin, PluginKey, TextSelection, type EditorState } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';
import { createMermaidWidget } from './editorMermaidWidget';

type TokenKind = 'comment' | 'string' | 'keyword' | 'number' | 'function' | 'operator' | 'punctuation';

const SCRIPT_GRAMMAR = /(?<comment>\/\/.*)|(?<string>`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*")|(?<keyword>\b(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield)\b)|(?<number>\b\d+(?:\.\d+)?\b)|(?<function>\b[A-Za-z_$][\w$]*(?=\s*\())|(?<operator>[+\-*/%=!<>|&?:]+)|(?<punctuation>[{}()[\].,;])/g;

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
};

const LANGUAGE_GRAMMARS: Record<string, RegExp> = {
  javascript: SCRIPT_GRAMMAR,
  typescript: SCRIPT_GRAMMAR,
  json: /(?<string>"(?:\\.|[^"])*")|(?<keyword>\b(?:true|false|null)\b)|(?<number>-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|(?<punctuation>[{}[\],:])/gi,
  css: /(?<comment>\/\*.*?\*\/)|(?<string>'(?:\\.|[^'])*'|"(?:\\.|[^"])*")|(?<keyword>\b(?:important|inherit|initial|unset|var|calc|rgb|rgba|hsl|hsla)\b)|(?<number>\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms)?\b)|(?<function>\b[a-z-]+(?=\())|(?<operator>[#@!]|[+\-*/=])|(?<punctuation>[{}()[\].,;:])/gi,
  bash: /(?<comment>#.*)|(?<string>'(?:\\.|[^'])*'|"(?:\\.|[^"])*")|(?<keyword>\b(?:case|do|done|elif|else|esac|fi|for|function|if|in|then|while)\b)|(?<number>\b\d+\b)|(?<function>\b(?:cd|cp|echo|export|git|mkdir|mv|npm|pnpm|rm|sed|yarn)(?=\s))|(?<operator>[|&;<>()$=]+)|(?<punctuation>[{}[\],])/g,
  yaml: /(?<comment>#.*)|(?<string>'(?:\\.|[^'])*'|"(?:\\.|[^"])*")|(?<keyword>\b(?:true|false|null|yes|no|on|off)\b)|(?<number>\b\d+(?:\.\d+)?\b)|(?<punctuation>[:[\]{},-])/gi,
};

const MERMAID_EDIT_EVENT = 'feishu-edit-mermaid-source';

function normalizeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  return LANGUAGE_ALIASES[normalized] ?? normalized;
}

function isSelectionInsideNode(state: EditorState, pos: number, nodeSize: number): boolean {
  const from = pos + 1;
  const to = pos + nodeSize - 1;
  return state.selection.from >= from && state.selection.to <= to;
}

function createCodeToolbar(code: string): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'feishu-editor-code-tools';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'feishu-editor-code-tools__copy';
  copyButton.textContent = '复制';
  copyButton.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  copyButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    void navigator.clipboard?.writeText(code).then(() => {
      copyButton.textContent = '已复制';
      window.setTimeout(() => {
        copyButton.textContent = '复制';
      }, 1600);
    });
  });

  toolbar.appendChild(copyButton);
  return toolbar;
}

function getMatchKind(groups: Record<string, string | undefined>): TokenKind | null {
  const kinds: TokenKind[] = ['comment', 'string', 'keyword', 'number', 'function', 'operator', 'punctuation'];
  return kinds.find((kind) => groups[kind]) ?? null;
}

function buildCodeDecorations(state: EditorState): DecorationSet {
  const decorations: Decoration[] = [];

  state.doc.descendants((node, pos) => {
    if (node.type.name === 'blockquote') {
      const marker = node.textContent.match(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i)?.[0];
      if (!marker) return;

      node.descendants((child, childPos) => {
        if (!child.isText || !child.text?.startsWith(marker)) return true;

        const from = pos + 1 + childPos;
        decorations.push(Decoration.inline(from, from + marker.length, {
          class: 'feishu-editor-callout-marker',
        }));
        return false;
      });
      return;
    }

    if (node.type.name !== 'code_block') return;

    const language = normalizeLanguage((node.attrs.language as string | undefined) ?? '');
    if (language === 'mermaid') {
      const isEditing = isSelectionInsideNode(state, pos, node.nodeSize);
      if (!isEditing) {
        decorations.push(Decoration.node(pos, pos + node.nodeSize, {
          class: 'feishu-editor-mermaid-source--hidden',
        }));
        decorations.push(Decoration.widget(
          pos + node.nodeSize,
          () => createMermaidWidget(node.textContent, pos, MERMAID_EDIT_EVENT),
          { side: 1, key: `mermaid-widget-${pos}-${node.textContent}` },
        ));
      }
      return;
    }

    decorations.push(Decoration.widget(
      pos,
      () => createCodeToolbar(node.textContent),
      { side: -1, key: `code-toolbar-${pos}-${node.textContent}` },
    ));

    const grammar = LANGUAGE_GRAMMARS[language];
    if (!grammar) return;

    const text = node.textContent;
    const tokenizer = new RegExp(grammar.source, grammar.flags);
    let match: RegExpExecArray | null;

    while ((match = tokenizer.exec(text)) !== null) {
      const kind = match.groups ? getMatchKind(match.groups) : null;
      if (!kind || match[0].length === 0) continue;

      const from = pos + 1 + match.index;
      const to = from + match[0].length;
      decorations.push(Decoration.inline(from, to, {
        class: `feishu-code-token feishu-code-token--${kind}`,
      }));
    }
  });

  return DecorationSet.create(state.doc, decorations);
}

export const editorCodeHighlightPlugin = $prose(() => new Plugin({
  key: new PluginKey('feishu-editor-code-highlight'),
  state: {
    init: (_, state) => buildCodeDecorations(state),
    apply: (tr, decorations, oldState, newState) => {
      if (tr.docChanged || !oldState.selection.eq(newState.selection)) {
        return buildCodeDecorations(newState);
      }
      return decorations.map(tr.mapping, tr.doc);
    },
  },
  props: {
    decorations(state) {
      return this.getState(state) as DecorationSet;
    },
    handleDOMEvents: {
      [MERMAID_EDIT_EVENT](view, event) {
        const pos = (event as CustomEvent<{ pos?: number }>).detail?.pos;
        if (typeof pos !== 'number') return false;

        const node = view.state.doc.nodeAt(pos);
        if (!node || node.type.name !== 'code_block') return false;

        const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + 1));
        view.dispatch(tr);
        view.focus();
        return true;
      },
    },
  },
}));
