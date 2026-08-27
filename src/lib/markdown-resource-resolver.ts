export type MarkdownRuntime = 'browser' | 'vscode-webview';
export type MarkdownResourceKind = 'asset' | 'link';

export interface MarkdownSourceContext {
  source: 'file' | 'github' | 'gitlab';
  runtime?: MarkdownRuntime;
  documentUrl: string;
  contentUrl?: string;
  assetBaseUrl: string;
  linkBaseUrl: string;
}

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const BROWSER_ASSET_PROTOCOLS = new Set(['file:', ...HTTP_PROTOCOLS]);
const DANGEROUS_PROTOCOLS = new Set(['javascript:', 'vbscript:', 'data:']);

function parseUrl(value: string, base?: string): URL | null {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

function directoryUrl(value: string): string {
  const parsed = parseUrl(value);
  if (!parsed) return value;
  return new URL('.', parsed).toString();
}

function getPathParts(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean);
}

function createGitHubContext(documentUrl: string, contentUrl?: string, runtime?: MarkdownRuntime): MarkdownSourceContext {
  const document = parseUrl(documentUrl);
  const content = contentUrl ? parseUrl(contentUrl) : null;
  if (!document) {
    return {
      source: 'github', runtime, documentUrl, contentUrl,
      assetBaseUrl: documentUrl, linkBaseUrl: documentUrl,
    };
  }

  const isRawDocument = document.hostname === 'raw.githubusercontent.com';
  const documentParts = getPathParts(document);
  const blobIndex = documentParts.indexOf('blob');
  const hasBlobShape = document.hostname === 'github.com'
    && blobIndex >= 2
    && documentParts.length > blobIndex + 2;

  if (isRawDocument) {
    const rawBase = directoryUrl((content ?? document).toString());
    return { source: 'github', runtime, documentUrl, contentUrl, assetBaseUrl: rawBase, linkBaseUrl: rawBase };
  }

  if (hasBlobShape) {
    const owner = documentParts[0] ?? '';
    const repo = documentParts[1] ?? '';
    const ref = documentParts[blobIndex + 1] ?? '';
    const fileParts = documentParts.slice(blobIndex + 2);
    const rawDocumentUrl = content?.hostname === 'raw.githubusercontent.com'
      ? content.toString()
      : `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${fileParts.join('/')}`;
    return {
      source: 'github',
      runtime,
      documentUrl,
      contentUrl: contentUrl ?? rawDocumentUrl,
      assetBaseUrl: directoryUrl(rawDocumentUrl),
      linkBaseUrl: directoryUrl(document.toString()),
    };
  }

  const fallbackBase = directoryUrl((content ?? document).toString());
  return { source: 'github', runtime, documentUrl, contentUrl, assetBaseUrl: fallbackBase, linkBaseUrl: fallbackBase };
}

function createGitLabContext(documentUrl: string, contentUrl?: string, runtime?: MarkdownRuntime): MarkdownSourceContext {
  const document = parseUrl(documentUrl);
  const content = contentUrl ? parseUrl(contentUrl) : null;
  if (!document) {
    return {
      source: 'gitlab', runtime, documentUrl, contentUrl,
      assetBaseUrl: documentUrl, linkBaseUrl: documentUrl,
    };
  }

  const parts = getPathParts(document);
  const blobIndex = parts.indexOf('blob');
  const hasBlobShape = document.hostname === 'gitlab.com'
    && blobIndex >= 2
    && parts.length > blobIndex + 2;

  if (hasBlobShape) {
    const rawDocumentUrl = content?.pathname.includes('/-/raw/')
      ? content.toString()
      : document.toString().replace('/-/blob/', '/-/raw/');
    return {
      source: 'gitlab',
      runtime,
      documentUrl,
      contentUrl: contentUrl ?? rawDocumentUrl,
      assetBaseUrl: directoryUrl(rawDocumentUrl),
      linkBaseUrl: directoryUrl(document.toString()),
    };
  }

  const fallbackBase = directoryUrl((content ?? document).toString());
  return { source: 'gitlab', runtime, documentUrl, contentUrl, assetBaseUrl: fallbackBase, linkBaseUrl: fallbackBase };
}

export function createMarkdownSourceContext(
  source: MarkdownSourceContext['source'],
  documentUrl: string,
  contentUrl?: string,
  runtime?: MarkdownRuntime,
): MarkdownSourceContext {
  if (source === 'github') return createGitHubContext(documentUrl, contentUrl, runtime);
  if (source === 'gitlab') return createGitLabContext(documentUrl, contentUrl, runtime);

  const base = directoryUrl(contentUrl ?? documentUrl);
  return {
    source,
    runtime,
    documentUrl,
    contentUrl,
    assetBaseUrl: base,
    linkBaseUrl: base,
  };
}

function allowedProtocols(context: MarkdownSourceContext | undefined, kind: MarkdownResourceKind): Set<string> {
  const allowed = new Set(kind === 'asset' ? BROWSER_ASSET_PROTOCOLS : [...BROWSER_ASSET_PROTOCOLS, 'mailto:']);
  if (context?.runtime === 'vscode-webview') allowed.add('vscode-webview-resource:');
  return allowed;
}

function isSafeUrl(url: URL, context: MarkdownSourceContext | undefined, kind: MarkdownResourceKind): boolean {
  if (DANGEROUS_PROTOCOLS.has(url.protocol)) return false;
  return allowedProtocols(context, kind).has(url.protocol);
}

export function resolveMarkdownUrl(
  value: string,
  context: MarkdownSourceContext | undefined,
  kind: MarkdownResourceKind,
): string | null {
  const input = value.trim();
  if (!input) return null;
  if (input.startsWith('#')) return input;

  // No context is used by pure Markdown callers. Preserve relative values,
  // while still filtering absolute dangerous protocols.
  if (!context) {
    const absolute = parseUrl(input);
    if (!absolute) return input;
    return isSafeUrl(absolute, context, kind) ? absolute.toString() : null;
  }

  const baseUrl = kind === 'asset' ? context.assetBaseUrl : context.linkBaseUrl;
  const resolved = parseUrl(input, baseUrl);
  if (!resolved || !isSafeUrl(resolved, context, kind)) return null;
  return resolved.toString();
}

export function resolveMarkdownSrcSet(
  value: string,
  context: MarkdownSourceContext | undefined,
): string | null {
  const candidates = value
    .split(',')
    .map((candidate) => candidate.trim())
    .filter(Boolean);
  const resolvedCandidates = candidates.flatMap((candidate) => {
    const match = /^(\S+)(?:\s+(.+))?$/.exec(candidate);
    if (!match?.[1]) return [];
    const resolved = resolveMarkdownUrl(match[1], context, 'asset');
    if (!resolved) return [];
    return [match[2] ? `${resolved} ${match[2]}` : resolved];
  });

  return resolvedCandidates.length > 0 ? resolvedCandidates.join(', ') : null;
}
