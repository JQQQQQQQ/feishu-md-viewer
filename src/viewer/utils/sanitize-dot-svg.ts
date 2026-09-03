import DOMPurify from 'dompurify';

const SAFE_DOT_URI = /^(?:(?:https?|mailto):|data:image\/(?:png|gif|jpeg|webp);base64,)/i;

/**
 * 清洗 Graphviz 输出的 SVG。
 *
 * DOT 图表不需要 Mermaid 的 foreignObject、边界扩展或文字主题注入，
 * 因此使用独立白名单，避免把 Mermaid 的布局假设带入 Graphviz。
 */
export function sanitizeDotSvg(svg: string): string {
  if (!svg.trim().startsWith('<svg')) return '';

  const sanitized = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: [
      'title',
      'desc',
      'a',
      'defs',
      'marker',
      'polygon',
      'polyline',
      'ellipse',
      'path',
      'line',
      'rect',
      'text',
      'tspan',
      'g',
    ],
    ADD_ATTR: [
      'xmlns',
      'xmlns:xlink',
      'viewBox',
      'class',
      'id',
      'fill',
      'fill-opacity',
      'stroke',
      'stroke-width',
      'stroke-linecap',
      'stroke-linejoin',
      'stroke-dasharray',
      'marker-start',
      'marker-mid',
      'marker-end',
      'transform',
      'cx',
      'cy',
      'rx',
      'ry',
      'x',
      'y',
      'dx',
      'dy',
      'text-anchor',
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'href',
      'xlink:href',
      'style',
    ],
    FORBID_TAGS: ['script', 'foreignObject', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: [
      'onerror',
      'onclick',
      'onload',
      'onmouseover',
      'onfocus',
      'onanimationstart',
    ],
    ALLOWED_URI_REGEXP: SAFE_DOT_URI,
  });

  const normalized = sanitized.trim();
  return normalized.startsWith('<svg') ? normalized : '';
}
