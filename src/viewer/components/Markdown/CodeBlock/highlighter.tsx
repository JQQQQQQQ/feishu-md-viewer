import type { ReactNode } from 'react';

type TokenKind =
  | 'comment'
  | 'property'
  | 'string'
  | 'keyword'
  | 'number'
  | 'function'
  | 'operator'
  | 'punctuation';

interface TokenMatch {
  kind: TokenKind;
  value: string;
}

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

const SCRIPT_GRAMMAR =
  /(?<comment>\/\/.*)|(?<string>`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*")|(?<keyword>\b(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield)\b)|(?<number>\b\d+(?:\.\d+)?\b)|(?<function>\b[A-Za-z_$][\w$]*(?=\s*\())|(?<operator>[+\-*/%=!<>|&?:]+)|(?<punctuation>[{}()[\].,;])/g;

const LANGUAGE_GRAMMARS: Record<string, RegExp> = {
  javascript: SCRIPT_GRAMMAR,
  json: /(?<property>"(?:\\.|[^"])*"(?=\s*:))|(?<string>"(?:\\.|[^"])*")|(?<keyword>\b(?:true|false|null)\b)|(?<number>-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|(?<punctuation>[{}[\],:])/gi,
  css: /(?<comment>\/\*.*?\*\/)|(?<string>'(?:\\.|[^'])*'|"(?:\\.|[^"])*")|(?<keyword>\b(?:important|inherit|initial|unset|var|calc|rgb|rgba|hsl|hsla)\b)|(?<number>\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms)?\b)|(?<function>\b[a-z-]+(?=\())|(?<operator>[#@!]|[+\-*/=])|(?<punctuation>[{}()[\].,;:])/gi,
  bash: /(?<comment>#.*)|(?<string>'(?:\\.|[^'])*'|"(?:\\.|[^"])*")|(?<keyword>\b(?:case|do|done|elif|else|esac|fi|for|function|if|in|then|while)\b)|(?<number>\b\d+\b)|(?<function>\b(?:cd|cp|echo|export|git|mkdir|mv|npm|pnpm|rm|sed|yarn)(?=\s))|(?<operator>[|&;<>()$=]+)|(?<punctuation>[{}[\],])/g,
  yaml: /(?<comment>#.*)|(?<string>'(?:\\.|[^'])*'|"(?:\\.|[^"])*")|(?<keyword>\b(?:true|false|null|yes|no|on|off)\b)|(?<number>\b\d+(?:\.\d+)?\b)|(?<punctuation>[:[\]{},-])/gi,
};

LANGUAGE_GRAMMARS.typescript = SCRIPT_GRAMMAR;

function normalizeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  return LANGUAGE_ALIASES[normalized] ?? normalized;
}

function getMatchKind(groups: Record<string, string | undefined>): TokenKind | null {
  const kinds: TokenKind[] = [
    'comment',
    'property',
    'string',
    'keyword',
    'number',
    'function',
    'operator',
    'punctuation',
  ];
  return kinds.find((kind) => groups[kind]) ?? null;
}

function tokenizeLine(line: string, grammar: RegExp): (string | TokenMatch)[] {
  const tokens: (string | TokenMatch)[] = [];
  const lineGrammar = new RegExp(grammar.source, grammar.flags);
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = lineGrammar.exec(line)) !== null) {
    if (match.index > cursor) tokens.push(line.slice(cursor, match.index));

    const value = match[0];
    const kind = match.groups ? getMatchKind(match.groups) : null;
    tokens.push(kind ? { kind, value } : value);
    cursor = match.index + value.length;
  }

  if (cursor < line.length) tokens.push(line.slice(cursor));
  return tokens;
}

export function highlightCode(code: string, language: string): ReactNode {
  const grammar = LANGUAGE_GRAMMARS[normalizeLanguage(language)];
  if (!grammar) return code;

  const lines = code.replace(/\n$/, '').split('\n');
  return lines.map((line, lineIndex) => (
    <span className="feishu-code-line" key={`line-${lineIndex}`}>
      {tokenizeLine(line, grammar).map((token, tokenIndex) =>
        typeof token === 'string' ? (
          token
        ) : (
          <span
            className={`feishu-code-token feishu-code-token--${token.kind}`}
            key={`${lineIndex}-${tokenIndex}`}
          >
            {token.value}
          </span>
        ),
      )}
      {lineIndex < lines.length - 1 ? '\n' : null}
    </span>
  ));
}
