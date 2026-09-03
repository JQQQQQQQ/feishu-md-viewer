type DotEngine = 'dot';

interface VizInstance {
  renderString: (
    code: string,
    options: { format: 'svg'; engine: DotEngine },
  ) => string;
}

const DOT_CACHE_MAX_BYTES = 2 * 1024 * 1024;
let vizPromise: Promise<VizInstance> | null = null;
const svgCache = new Map<string, { svg: string; bytes: number }>();
let cacheBytes = 0;

function getStringByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length * 2;
}

function readCachedSvg(key: string): string | null {
  const entry = svgCache.get(key);
  if (!entry) return null;

  // Refresh the insertion order so this map behaves as a small LRU cache.
  svgCache.delete(key);
  svgCache.set(key, entry);
  return entry.svg;
}

function cacheSvg(key: string, svg: string): void {
  const previous = svgCache.get(key);
  if (previous) {
    cacheBytes -= previous.bytes;
    svgCache.delete(key);
  }

  const bytes = getStringByteLength(key) + getStringByteLength(svg);
  svgCache.set(key, { svg, bytes });
  cacheBytes += bytes;

  while (cacheBytes > DOT_CACHE_MAX_BYTES && svgCache.size > 0) {
    const oldestKey = svgCache.keys().next().value;
    if (typeof oldestKey !== 'string') break;

    const oldest = svgCache.get(oldestKey);
    if (oldest) cacheBytes -= oldest.bytes;
    svgCache.delete(oldestKey);
  }
}

function loadViz(): Promise<VizInstance> {
  if (!vizPromise) {
    vizPromise = import('@viz-js/viz')
      .then(({ instance }) => instance())
      .catch((error) => {
        vizPromise = null;
        throw error;
      });
  }
  return vizPromise;
}

export async function renderDot(code: string, engine: DotEngine = 'dot'): Promise<string> {
  const key = `${engine}\0${code}`;
  const cached = readCachedSvg(key);
  if (cached) return cached;

  try {
    const viz = await loadViz();
    const svg = viz.renderString(code, { format: 'svg', engine });
    if (!svg.trim().startsWith('<svg')) {
      throw new Error('Graphviz 未返回有效 SVG');
    }
    cacheSvg(key, svg);
    return svg;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message || 'DOT 渲染失败');
  }
}
