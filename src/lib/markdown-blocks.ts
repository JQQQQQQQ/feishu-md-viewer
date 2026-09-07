import { getMarkdownContentHash } from './markdown-performance';

export type MarkdownBlockKind =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'blockquote'
  | 'table'
  | 'code'
  | 'mermaid'
  | 'image'
  | 'html'
  | 'thematic-break'
  | 'unknown';

export interface MarkdownBlock {
  kind: MarkdownBlockKind;
  source: string;
  startLine: number;
  endLine: number;
  contentHash: string;
  headingPath: string[];
  tableOrdinal?: number;
  renderKey: string;
  boundaryConfidence: 'safe' | 'unsafe';
}

export interface MarkdownBlockDiff {
  unchanged: MarkdownBlock[];
  added: MarkdownBlock[];
  removed: MarkdownBlock[];
  changed: Array<{ previous: MarkdownBlock; next: MarkdownBlock }>;
  requiresFullParse: boolean;
  fallbackReason?: string;
}

interface Fence {
  character: '`' | '~';
  length: number;
  language: string;
}

function isBlank(line: string | undefined): boolean {
  return line === undefined || line.trim() === '';
}

function leadingSpaces(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function readFence(line: string): Fence | null {
  const match = /^\s{0,3}(`{3,}|~{3,})\s*([^\s]*)?.*$/.exec(line);
  if (!match?.[1]) return null;
  return {
    character: match[1][0] as '`' | '~',
    length: match[1].length,
    language: match[2]?.toLowerCase() ?? '',
  };
}

function isClosingFence(line: string, fence: Fence): boolean {
  const pattern = new RegExp(`^\\s{0,3}${fence.character}{${fence.length},}\\s*$`);
  return pattern.test(line);
}

function isHeading(line: string): boolean {
  return /^\s{0,3}#{1,6}(?:\s+|$)/.test(line);
}

function isListItem(line: string): boolean {
  return /^\s{0,3}(?:[-+*]|\d+[.)])\s+/.test(line);
}

function isBlockquote(line: string): boolean {
  return /^\s{0,3}>/.test(line);
}

function isThematicBreak(line: string): boolean {
  return /^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line);
}

function isImageOnly(line: string): boolean {
  return /^\s*!\[[^\]]*\]\([^\n)]*\)\s*$/.test(line);
}

function hasTablePipe(line: string): boolean {
  return line.includes('|');
}

function isTableSeparator(line: string): boolean {
  if (!hasTablePipe(line)) return false;
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  return cells.length > 0 && cells.every((cell) => /^\s*:?-{1,}:?\s*$/.test(cell));
}

function isTableStart(lines: string[], index: number): boolean {
  return hasTablePipe(lines[index] ?? '') && isTableSeparator(lines[index + 1] ?? '');
}

const pairedHtmlTags = new Set([
  'details',
  'div',
  'section',
  'article',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'ul',
  'ol',
  'blockquote',
  'figure',
  'picture',
  'video',
  'pre',
  'aside',
  'header',
  'footer',
]);

function readHtmlTag(
  line: string,
): { name: string; closing: boolean; selfClosing: boolean } | null {
  const match = /^\s*<\/?([A-Za-z][\w-]*)(?:\s[^>]*)?>\s*$/.exec(line);
  if (!match?.[1]) return null;
  return {
    name: match[1].toLowerCase(),
    closing: /^\s*<\//.test(line),
    selfClosing: /\/\s*>\s*$/.test(line),
  };
}

function isHtmlBlockStart(line: string): boolean {
  const tag = /^\s*<([A-Za-z][\w-]*)(?:\s[^>]*)?>/.exec(line);
  return Boolean(tag?.[1] && pairedHtmlTags.has(tag[1].toLowerCase()));
}

function isPotentialBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? '';
  return Boolean(
    readFence(line) ||
    isHeading(line) ||
    isListItem(line) ||
    isBlockquote(line) ||
    isThematicBreak(line) ||
    isImageOnly(line) ||
    isHtmlBlockStart(line) ||
    isTableStart(lines, index),
  );
}

function headingLevel(line: string): number | null {
  const match = /^\s{0,3}(#{1,6})(?:\s+|$)/.exec(line);
  return match?.[1]?.length ?? null;
}

function createBlock(
  kind: MarkdownBlockKind,
  lines: string[],
  start: number,
  end: number,
  headingPath: string[],
  boundaryConfidence: 'safe' | 'unsafe' = 'safe',
  renderOccurrences: Map<string, number>,
): MarkdownBlock {
  const source = lines.slice(start, end + 1).join('\n');
  const contentHash = getMarkdownContentHash(source);
  const signature = `${kind}|${contentHash}|${headingPath.join('/')}`;
  const occurrence = (renderOccurrences.get(signature) ?? 0) + 1;
  renderOccurrences.set(signature, occurrence);
  return {
    kind,
    source,
    startLine: start + 1,
    endLine: end + 1,
    contentHash,
    headingPath: [...headingPath],
    renderKey: `block-${getMarkdownContentHash(`${signature}|${occurrence}`)}`,
    boundaryConfidence,
  };
}

export function indexMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  const renderOccurrences = new Map<string, number>();
  const headingCounts = new Map<number, number>();
  const headingPath: string[] = [];
  const tableOrdinals = new Map<string, number>();
  let index = 0;

  const append = (
    kind: MarkdownBlockKind,
    start: number,
    end: number,
    confidence: 'safe' | 'unsafe' = 'safe',
  ) => {
    const block = createBlock(kind, lines, start, end, headingPath, confidence, renderOccurrences);
    if (kind === 'table') {
      const path = headingPath.join('/') || 'root';
      const ordinal = (tableOrdinals.get(path) ?? 0) + 1;
      tableOrdinals.set(path, ordinal);
      block.tableOrdinal = ordinal;
    }
    blocks.push(block);
  };

  while (index < lines.length) {
    if (isBlank(lines[index])) {
      index += 1;
      continue;
    }

    const start = index;
    const line = lines[index] ?? '';
    const fence = readFence(line);
    if (fence) {
      index += 1;
      while (index < lines.length && !isClosingFence(lines[index] ?? '', fence)) index += 1;
      if (index >= lines.length) {
        append(
          fence.language === 'mermaid' ? 'mermaid' : 'code',
          start,
          lines.length - 1,
          'unsafe',
        );
        break;
      }
      append(fence.language === 'mermaid' ? 'mermaid' : 'code', start, index);
      index += 1;
      continue;
    }

    if (leadingSpaces(line) >= 4) {
      index += 1;
      while (index < lines.length) {
        if (leadingSpaces(lines[index] ?? '') >= 4) {
          index += 1;
          continue;
        }
        if (isBlank(lines[index]) && leadingSpaces(lines[index + 1] ?? '') >= 4) {
          index += 1;
          continue;
        }
        break;
      }
      append('code', start, index - 1);
      continue;
    }

    const level = headingLevel(line);
    if (level !== null) {
      while (headingPath.length >= level) headingPath.pop();
      const occurrence = (headingCounts.get(level) ?? 0) + 1;
      headingCounts.set(level, occurrence);
      headingPath.push(`${level}:${occurrence}`);
      append('heading', start, start);
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      index += 2;
      while (index < lines.length && !isBlank(lines[index]) && hasTablePipe(lines[index] ?? ''))
        index += 1;
      append('table', start, index - 1);
      continue;
    }

    if (isHtmlBlockStart(line)) {
      const firstTag = readHtmlTag(line);
      if (!firstTag || firstTag.selfClosing || firstTag.closing) {
        append('html', start, start);
        index += 1;
        continue;
      }
      let depth = 1;
      index += 1;
      while (index < lines.length && depth > 0) {
        const tag = readHtmlTag(lines[index] ?? '');
        if (tag?.name === firstTag.name) {
          if (tag.closing) depth -= 1;
          else if (!tag.selfClosing) depth += 1;
        }
        index += 1;
      }
      if (depth > 0) {
        append('unknown', start, lines.length - 1, 'unsafe');
        break;
      }
      append('html', start, index - 1);
      continue;
    }

    if (isThematicBreak(line)) {
      append('thematic-break', start, start);
      index += 1;
      continue;
    }

    if (isImageOnly(line)) {
      append('image', start, start);
      index += 1;
      continue;
    }

    if (isBlockquote(line)) {
      index += 1;
      while (index < lines.length) {
        if (isBlockquote(lines[index] ?? '')) {
          index += 1;
          continue;
        }
        if (isBlank(lines[index]) && isBlockquote(lines[index + 1] ?? '')) {
          index += 1;
          continue;
        }
        break;
      }
      append('blockquote', start, index - 1);
      continue;
    }

    if (isListItem(line)) {
      const baseIndent = leadingSpaces(line);
      index += 1;
      while (index < lines.length) {
        const next = lines[index] ?? '';
        if (isListItem(next) || (!isBlank(next) && leadingSpaces(next) > baseIndent)) {
          index += 1;
          continue;
        }
        if (
          isBlank(next) &&
          (isListItem(lines[index + 1] ?? '') || leadingSpaces(lines[index + 1] ?? '') > baseIndent)
        ) {
          index += 1;
          continue;
        }
        break;
      }
      append('list', start, index - 1);
      continue;
    }

    index += 1;
    while (index < lines.length && !isBlank(lines[index])) {
      if (isPotentialBlockStart(lines, index)) break;
      index += 1;
    }
    append('paragraph', start, index - 1);
  }

  return blocks;
}

function blockSignature(block: MarkdownBlock): string {
  return `${block.kind}|${block.contentHash}|${block.headingPath.join('/')}`;
}

function firstUnsafeBlock(blocks: MarkdownBlock[]): MarkdownBlock | undefined {
  return blocks.find((block) => block.boundaryConfidence === 'unsafe');
}

function headingSignatures(blocks: MarkdownBlock[]): string[] {
  return blocks.filter((block) => block.kind === 'heading').map(blockSignature);
}

export function diffMarkdownBlocks(
  previous: MarkdownBlock[],
  next: MarkdownBlock[],
): MarkdownBlockDiff {
  const unsafe = firstUnsafeBlock(previous) ?? firstUnsafeBlock(next);
  if (unsafe) {
    return {
      unchanged: [],
      added: next,
      removed: previous,
      changed: [],
      requiresFullParse: true,
      fallbackReason: `检测到无法确定的 Markdown 块边界（${unsafe.startLine}-${unsafe.endLine} 行）`,
    };
  }

  const previousHeadings = headingSignatures(previous);
  const nextHeadings = headingSignatures(next);
  if (
    previousHeadings.length !== nextHeadings.length ||
    previousHeadings.some((signature, index) => signature !== nextHeadings[index])
  ) {
    return {
      unchanged: [],
      added: next,
      removed: previous,
      changed: [],
      requiresFullParse: true,
      fallbackReason: '标题内容或标题路径发生变化，需要重新建立全局标题元数据',
    };
  }

  const queues = new Map<string, MarkdownBlock[]>();
  previous.forEach((block) => {
    const queue = queues.get(blockSignature(block)) ?? [];
    queue.push(block);
    queues.set(blockSignature(block), queue);
  });
  const matched = new Set<MarkdownBlock>();
  const unchanged: MarkdownBlock[] = [];
  const added: MarkdownBlock[] = [];
  const changed: Array<{ previous: MarkdownBlock; next: MarkdownBlock }> = [];

  next.forEach((block, index) => {
    const queue = queues.get(blockSignature(block));
    const match = queue?.shift();
    if (match) {
      matched.add(match);
      unchanged.push({ ...block, renderKey: match.renderKey });
      return;
    }

    const positional = previous[index];
    if (positional && !matched.has(positional) && positional.kind === block.kind) {
      matched.add(positional);
      changed.push({ previous: positional, next: block });
      return;
    }
    added.push(block);
  });

  const removed = previous.filter((block) => !matched.has(block));
  return {
    unchanged,
    added,
    removed,
    changed,
    requiresFullParse: false,
  };
}
