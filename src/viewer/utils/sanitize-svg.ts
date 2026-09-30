import DOMPurify from 'dompurify';
import { expandMermaidSvgBounds } from './mermaid-svg';

const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const SVG_NS = 'http://www.w3.org/2000/svg';
const HTML_TAGS_IN_FOREIGN_OBJECT = new Set(['div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i']);
// Mermaid emits these paints inline even when the author did not provide a
// `style` or `classDef`. Treating those generated defaults as custom colors
// prevents the viewer theme from adapting the diagram in dark mode.
const DEFAULT_MERMAID_PAINTS = new Set([
  '#eef4ff',
  '#8fb1ff',
  '#1f2329',
  '#5b7cff',
  '#243b66',
  '#6d9aff',
  '#f2f5ff',
  '#8eabff',
  '#ececff',
  '#9370db',
  '#f4f4f4',
  '#333333',
  '#e0e0e0',
]);

function appendStyle(element: Element, declaration: string): void {
  const style = element.getAttribute('style');
  element.setAttribute('style', style ? `${style}; ${declaration}` : declaration);
}

function getStyleProperty(element: Element, property: string): string | null {
  const style = element.getAttribute('style') ?? '';
  const propertyPattern = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = style.match(new RegExp(`(?:^|;)\\s*${propertyPattern}\\s*:\\s*([^;]+)`, 'i'));
  return match?.[1]?.trim() ?? null;
}

function normalizeCssColor(value: string): string {
  const compact = value.trim().toLowerCase().replace(/\s+/g, '');
  const hexMatch = compact.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch?.[1]) {
    const hex = hexMatch[1];
    return hex.length === 3
      ? `#${hex.split('').map((part) => `${part}${part}`).join('')}`
      : `#${hex}`;
  }

  const rgbMatch = compact.match(/^rgba?\((\d+),(\d+),(\d+)(?:,[^)]+)?\)$/i);
  if (rgbMatch) {
    return `#${[rgbMatch[1], rgbMatch[2], rgbMatch[3]]
      .map((part) => Number(part).toString(16).padStart(2, '0'))
      .join('')}`;
  }

  return compact;
}

function isDefaultMermaidPaint(value: string): boolean {
  const normalized = normalizeCssColor(value);
  return normalized === 'none' || normalized === 'transparent' || DEFAULT_MERMAID_PAINTS.has(normalized);
}

function hasMermaidClassDefStyle(element: Element, styleText: string): boolean {
  const node = element.closest('.node');
  if (!node) return false;

  return Array.from(node.classList)
    .filter((className) => className !== 'node' && className !== 'default')
    .some((className) => {
      const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Mermaid 11 emits classDef rules as `.start>*` / `.start span` with
      // `!important`, while older versions may emit `.node.start`. Avoid
      // treating renderer internals such as `.statediagram-state rect.basic`
      // as user-defined colors.
      const legacyClassDef = new RegExp(
        `\\.node(?:\\.${escapedClassName}(?:\\b|[.# >+~:{])|\\s+\\.${escapedClassName}(?:\\b|[.# >+~:{]))`,
      );
      const modernClassDef = new RegExp(
        `\\.${escapedClassName}(?:\\s*>\\s*\\*|\\s+(?:span|tspan|\\.nodeLabel))\\s*\\{[^}]*!important`,
      );
      return legacyClassDef.test(styleText) || modernClassDef.test(styleText);
    });
}

function markCustomMermaidNodes(root: Element, styleText: string): void {
  root.querySelectorAll('.node').forEach((node) => {
    const hasClassDef = hasMermaidClassDefStyle(node, styleText);
    const hasInlineColor = [node, ...Array.from(node.querySelectorAll('*'))].some(
      (element) => ['fill', 'stroke'].some((property) => {
        const value = getStyleProperty(element, property);
        return Boolean(value && !isDefaultMermaidPaint(value));
      }),
    );
    if (hasClassDef || hasInlineColor) {
      node.setAttribute('data-feishu-mermaid-custom-color', 'true');
      // Mermaid 11 writes classDef colors directly to several descendants
      // inside foreignObject (div/span/p), not only to the node group. Mark
      // the complete subtree so the viewer's generic theme rules can leave
      // those explicit colors untouched.
      node.querySelectorAll('*').forEach((descendant) => {
        descendant.setAttribute('data-feishu-mermaid-custom-color', 'true');
      });
    }
  });
}

function pinDefaultMermaidNodeTheme(root: Element): void {
  root.querySelectorAll('.node').forEach((node) => {
    if (node.getAttribute('data-feishu-mermaid-custom-color') === 'true') return;

    Array.from(node.children)
      .filter((element) => ['rect', 'polygon', 'circle', 'ellipse', 'path'].includes(element.tagName.toLowerCase()))
      .forEach((element) => {
        appendStyle(
          element,
          'fill: var(--feishu-mermaid-node-bg) !important; stroke: var(--feishu-mermaid-node-border) !important',
        );
      });
  });
}

function restoreForeignObjectNamespaces(svgText: string): string {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return svgText;
  }

  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return svgText;

  const root = doc.documentElement;
  if (root.tagName.toLowerCase() !== 'svg') return svgText;

  root.querySelectorAll('foreignObject *').forEach((node) => {
    const element = node as Element;
    const tagName = element.tagName.toLowerCase();
    if (!HTML_TAGS_IN_FOREIGN_OBJECT.has(tagName)) return;
    if (element.namespaceURI !== SVG_NS && element.getAttribute('xmlns') === XHTML_NS) return;
    element.setAttribute('xmlns', XHTML_NS);
  });

  return new XMLSerializer().serializeToString(root);
}

function pinMermaidTextTheme(root: Element): void {
  const styleText = Array.from(root.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');
  markCustomMermaidNodes(root, styleText);
  pinDefaultMermaidNodeTheme(root);

  Array.from(root.querySelectorAll('.nodeLabel, .nodeLabel *, text, text *'))
    .reverse()
    .forEach((element) => {
      const node = element.closest('.node');
      const hasCustomNodeColor = node?.getAttribute('data-feishu-mermaid-custom-color') === 'true';
      if (hasCustomNodeColor || hasMermaidClassDefStyle(element, styleText)) return;

      // Default Mermaid inline paints must follow the active viewer theme. A
      // custom node was marked above and is intentionally left untouched.
      appendStyle(
        element,
        'color: var(--feishu-mermaid-node-text) !important; fill: var(--feishu-mermaid-node-text) !important; -webkit-text-fill-color: var(--feishu-mermaid-node-text) !important',
      );
    });
}

function countLikelyNodeLabels(svgText: string): number {
  const classMatches = svgText.match(/class="[^"]*nodeLabel[^"]*"/g)?.length ?? 0;
  const textMatches = svgText.match(/<(?:text|span|p)[^>]*>[^<\s][\s\S]*?<\/(?:text|span|p)>/g)?.length ?? 0;
  return classMatches + textMatches;
}

export interface SanitizeMermaidSvgOptions {
  /** The MermaidBlock path expands the SVG before rendering it. Previewing a
   * serialized DOM node must skip that second geometry expansion. */
  expandBounds?: boolean;
}

export function sanitizeMermaidSvg(
  svg: string,
  options: SanitizeMermaidSvgOptions = {},
): string {
  const expanded = options.expandBounds === false ? svg : expandMermaidSvgBounds(svg);
  let preparedSvg = expanded;
  const originalLabelCount = countLikelyNodeLabels(preparedSvg);

  // Mermaid embeds an ID-scoped stylesheet in every SVG. In WebViews and
  // shadow roots that stylesheet can outrank the viewer's external rules, so
  // pin Mermaid text to the theme at the serialized SVG boundary.
  if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
    const doc = new DOMParser().parseFromString(preparedSvg, 'image/svg+xml');
    if (!doc.querySelector('parsererror') && doc.documentElement.tagName.toLowerCase() === 'svg') {
      pinMermaidTextTheme(doc.documentElement);
      preparedSvg = new XMLSerializer().serializeToString(doc.documentElement);
    }
  }

  const sanitized = DOMPurify.sanitize(preparedSvg, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    HTML_INTEGRATION_POINTS: { foreignobject: true },
    ADD_TAGS: ['foreignObject', 'div', 'span', 'p', 'br'],
    ADD_ATTR: ['xmlns', 'xmlns:xlink', 'class', 'style', 'data-feishu-mermaid-custom-color'],
  });

  const normalized = restoreForeignObjectNamespaces(sanitized);
  const normalizedLabelCount = countLikelyNodeLabels(normalized);

  // Mermaid output should already be sanitized by Mermaid itself (securityLevel strict).
  // If DOMPurify pass accidentally strips almost all node labels, keep diagram readable.
  if (originalLabelCount >= 2 && normalizedLabelCount === 0) {
    return restoreForeignObjectNamespaces(preparedSvg);
  }

  return normalized;
}
