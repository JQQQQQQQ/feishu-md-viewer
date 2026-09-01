import DOMPurify from 'dompurify';
import { expandMermaidSvgBounds } from './mermaid-svg';

const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const SVG_NS = 'http://www.w3.org/2000/svg';
const HTML_TAGS_IN_FOREIGN_OBJECT = new Set(['div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i']);
const MERMAID_TEXT_THEME_STYLE =
  'color: var(--feishu-mermaid-node-text) !important; fill: var(--feishu-mermaid-node-text) !important; -webkit-text-fill-color: var(--feishu-mermaid-node-text) !important';

function appendStyle(element: Element, declaration: string): void {
  const style = element.getAttribute('style');
  element.setAttribute('style', style ? `${style}; ${declaration}` : declaration);
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
  root
    .querySelectorAll('.nodeLabel, .nodeLabel *, text, text *')
    .forEach((element) => appendStyle(element, MERMAID_TEXT_THEME_STYLE));
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
    ADD_ATTR: ['xmlns', 'xmlns:xlink', 'class', 'style'],
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
