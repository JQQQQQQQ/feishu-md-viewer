import DOMPurify from 'dompurify';

const SAFE_DOT_URI = /^(?:(?:https?|mailto):|data:image\/(?:png|gif|jpeg|webp);base64,)/i;
const SAFE_SVG_LENGTH = /^\d+(?:\.\d+)?(?:pt|px|em|ex|cm|mm|in|pc|%)?$/i;
const SAFE_NUMBER_LIST = /^[\dEe+\-.,\s]+$/;
const SAFE_TRANSFORM = /^[\dEe+\-.,\s()]+$/;
const SAFE_PATH = /^[\dEe+\-.,\sMmLlHhVvCcSsQqTtAaZz]+$/;
const SAFE_TEXT_VALUE = /^[^<>"']{0,256}$/;
const SAFE_GRAPHVIZ_ATTRS = new Set([
  'width',
  'height',
  'viewbox',
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
  'd',
  'points',
  'text-anchor',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
]);

function readAttributes(rawAttributes: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of rawAttributes.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) {
    const name = match[1]?.toLowerCase();
    const value = match[2];
    if (name && value !== undefined) attributes.set(name, value);
  }
  return attributes;
}

function isSafeGraphvizAttribute(name: string, value: string): boolean {
  if (!SAFE_GRAPHVIZ_ATTRS.has(name)) return false;
  if (name === 'width' || name === 'height') return SAFE_SVG_LENGTH.test(value);
  if (name === 'd') return SAFE_PATH.test(value);
  if (name === 'points') return SAFE_NUMBER_LIST.test(value);
  if (name === 'transform') {
    return SAFE_TRANSFORM.test(value);
  }
  if (['cx', 'cy', 'rx', 'ry', 'x', 'y', 'dx', 'dy', 'font-size', 'stroke-width', 'fill-opacity'].includes(name)) {
    return SAFE_NUMBER_LIST.test(value);
  }
  return SAFE_TEXT_VALUE.test(value);
}

function restoreGraphvizAttributes(sanitized: string, source: string): string {
  const sourceOpeningTags = [...source.matchAll(/<([A-Za-z][\w:.-]*)(?:\s+([^<>]*?))?\s*\/?>/g)];
  let sourceIndex = 0;

  return sanitized.replace(/<([A-Za-z][\w:.-]*)(\s[^<>]*?)?>/g, (openingTag, tagName: string, rawAttributes = '') => {
    const normalizedTag = tagName.toLowerCase();
    let sourceMatch = sourceOpeningTags[sourceIndex];
    while (sourceMatch && sourceMatch[1]?.toLowerCase() !== normalizedTag) {
      sourceIndex += 1;
      sourceMatch = sourceOpeningTags[sourceIndex];
    }
    if (!sourceMatch) return openingTag;
    sourceIndex += 1;

    const sanitizedAttributes = readAttributes(rawAttributes);
    const sourceAttributes = readAttributes(sourceMatch[2] ?? '');
    let restoredAttributes = rawAttributes;
    for (const [name, value] of sourceAttributes) {
      if (sanitizedAttributes.has(name) || !isSafeGraphvizAttribute(name, value)) continue;
      restoredAttributes += ` ${name}="${value}"`;
    }
    return `<${tagName}${restoredAttributes}>`;
  });
}

/**
 * 清洗 Graphviz 输出的 SVG。
 *
 * DOT 图表不需要 Mermaid 的 foreignObject、边界扩展或文字主题注入，
 * 因此使用独立白名单，避免把 Mermaid 的布局假设带入 Graphviz。
 */
export function sanitizeDotSvg(svg: string): string {
  if (!/<svg(?:\s|>)/i.test(svg)) return '';

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
      'width',
      'height',
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
      'd',
      'points',
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

  const normalized = restoreGraphvizAttributes(sanitized.trim(), svg);
  return /<svg(?:\s|>)/i.test(normalized) ? normalized : '';
}
