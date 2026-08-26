type MermaidAPI = {
  initialize: (config: Record<string, unknown>) => void;
  parse: (code: string) => Promise<unknown>;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

let mermaidInstance: MermaidAPI | null = null;
let loadingPromise: Promise<MermaidAPI> | null = null;
let renderQueue: Promise<void> = Promise.resolve();
const MERMAID_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const MERMAID_FONT_SIZE = 14;
const MERMAID_CACHE_MAX_BYTES = 2 * 1024 * 1024;
const mermaidSvgCache = new Map<string, { svg: string; bytes: number }>();
let mermaidCacheBytes = 0;

function getStringByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return text.length * 2;
}

function getCachedMermaidSvg(code: string): string | null {
  const cached = mermaidSvgCache.get(code);
  if (!cached) {
    return null;
  }

  mermaidSvgCache.delete(code);
  mermaidSvgCache.set(code, cached);
  return cached.svg;
}

function setCachedMermaidSvg(code: string, svg: string): void {
  const existing = mermaidSvgCache.get(code);
  if (existing) {
    mermaidCacheBytes -= existing.bytes;
    mermaidSvgCache.delete(code);
  }

  const entry = { svg, bytes: getStringByteLength(code) + getStringByteLength(svg) };
  mermaidSvgCache.set(code, entry);
  mermaidCacheBytes += entry.bytes;

  while (mermaidCacheBytes > MERMAID_CACHE_MAX_BYTES && mermaidSvgCache.size > 0) {
    const oldestKey = mermaidSvgCache.keys().next().value;
    if (typeof oldestKey !== 'string') break;

    const oldestEntry = mermaidSvgCache.get(oldestKey);
    if (oldestEntry) {
      mermaidCacheBytes -= oldestEntry.bytes;
    }
    mermaidSvgCache.delete(oldestKey);
  }
}

async function loadMermaid(): Promise<MermaidAPI> {
  if (mermaidInstance) return mermaidInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = import('mermaid').then((mod) => {
    const mermaid = mod.default as MermaidAPI;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      fontFamily: MERMAID_FONT_FAMILY,
      fontSize: MERMAID_FONT_SIZE,
      htmlLabels: true,
      theme: 'base',
      themeVariables: {
        primaryColor: '#eef4ff',
        primaryBorderColor: '#8fb1ff',
        primaryTextColor: '#1f2329',
        secondaryColor: '#f2f7ff',
        tertiaryColor: '#f7f9fc',
        lineColor: '#5b7cff',
        fontSize: `${MERMAID_FONT_SIZE}px`,
        fontFamily: MERMAID_FONT_FAMILY,
      },
      flowchart: {
        useMaxWidth: true,
        curve: 'basis',
        padding: 24,
        nodeSpacing: 42,
        rankSpacing: 52,
      },
      sequence: {
        useMaxWidth: true,
      },
      block: {
        padding: 20,
      },
    });
    mermaidInstance = mermaid;
    return mermaid;
  });

  return loadingPromise;
}

export async function renderMermaid(code: string, id: string): Promise<string> {
  const cached = getCachedMermaidSvg(code);
  if (cached) {
    return cached;
  }

  const renderTask = renderQueue.then(
    () => renderMermaidNow(code, id),
    () => renderMermaidNow(code, id)
  );

  renderQueue = renderTask.then(
    () => undefined,
    () => undefined
  );

  return renderTask;
}

async function renderMermaidNow(code: string, id: string): Promise<string> {
  const cached = getCachedMermaidSvg(code);
  if (cached) {
    return cached;
  }

  const mermaid = await loadMermaid();

  // Validate syntax first — parse() gives clean error messages
  try {
    await mermaid.parse(code);
  } catch (parseError) {
    const msg = parseError instanceof Error ? parseError.message : String(parseError);
    throw new Error(msg || '语法错误：无法解析 Mermaid 代码');
  }

  const container = document.createElement('div');
  container.id = `${id}-container`;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '100%';
  container.style.fontFamily = MERMAID_FONT_FAMILY;
  container.style.fontSize = `${MERMAID_FONT_SIZE}px`;
  document.body.appendChild(container);

  try {
    const { svg } = await mermaid.render(id, code);
    setCachedMermaidSvg(code, svg);
    return svg;
  } catch (renderError) {
    const msg = renderError instanceof Error ? renderError.message : String(renderError);
    console.error('Mermaid render failed', renderError);
    throw new Error(msg || 'Mermaid 渲染失败');
  } finally {
    container.remove();
    const cleanup = document.getElementById(id);
    if (cleanup) cleanup.remove();
    document.querySelectorAll('[id^="dmermaid-"]').forEach((el) => el.remove());
  }
}
