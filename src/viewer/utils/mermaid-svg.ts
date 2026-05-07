const EXTRA_X = 30;
const EXTRA_Y = 12;
const FOREIGN_OBJECT_X = 16;
const FOREIGN_OBJECT_Y = 8;

function parseNumbers(value: string): number[] {
  return value
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(Number.isFinite);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function parseLength(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(-?\d+(?:\.\d+)?)(px)?$/);
  return match?.[1] ? Number(match[1]) : null;
}

function setLength(element: Element, name: string, value: number): void {
  element.setAttribute(name, formatNumber(value));
}

function appendOverflowVisible(element: Element): void {
  const style = element.getAttribute('style');
  if (style?.includes('overflow')) return;
  element.setAttribute('style', style ? `${style}; overflow: visible` : 'overflow: visible');
}

function appendStyle(element: Element, declaration: string): void {
  const style = element.getAttribute('style');
  element.setAttribute('style', style ? `${style}; ${declaration}` : declaration);
}

function expandRootSvg(svg: SVGSVGElement): void {
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = parseNumbers(viewBox);
    if (parts.length === 4) {
      const [x, y, width, height] = parts as [number, number, number, number];
      svg.setAttribute(
        'viewBox',
        [
          formatNumber(x - EXTRA_X),
          formatNumber(y - EXTRA_Y),
          formatNumber(width + EXTRA_X * 2),
          formatNumber(height + EXTRA_Y * 2),
        ].join(' '),
      );
    }
  }

  const width = parseLength(svg.getAttribute('width'));
  if (width !== null) setLength(svg, 'width', width + EXTRA_X * 2);

  const height = parseLength(svg.getAttribute('height'));
  if (height !== null) setLength(svg, 'height', height + EXTRA_Y * 2);
}

function expandForeignObject(element: Element): void {
  const x = parseLength(element.getAttribute('x'));
  if (x !== null) setLength(element, 'x', x - FOREIGN_OBJECT_X);

  const width = parseLength(element.getAttribute('width'));
  if (width !== null) setLength(element, 'width', width + FOREIGN_OBJECT_X * 2);

  const y = parseLength(element.getAttribute('y'));
  if (y !== null) setLength(element, 'y', y - FOREIGN_OBJECT_Y);

  const height = parseLength(element.getAttribute('height'));
  if (height !== null) setLength(element, 'height', height + FOREIGN_OBJECT_Y * 2);
}

function relaxTextSizing(root: Element): void {
  root.querySelectorAll('text, tspan').forEach((element) => {
    element.removeAttribute('textLength');
    element.removeAttribute('lengthAdjust');
  });
}

function resetForeignObjectText(root: Element): void {
  root.querySelectorAll('foreignObject p').forEach((element) => {
    appendStyle(element, 'margin: 0; line-height: 1.2');
  });
}

export function expandMermaidSvgBounds(svgText: string): string {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return svgText;
  }

  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return svgText;

  const svg = doc.documentElement;
  if (svg.tagName.toLowerCase() !== 'svg') return svgText;

  svg.querySelectorAll('[clip-path]').forEach((element) => {
    element.removeAttribute('clip-path');
  });

  expandRootSvg(svg as unknown as SVGSVGElement);
  svg.querySelectorAll('svg, g, text, tspan, foreignObject, div, span').forEach(appendOverflowVisible);
  svg.querySelectorAll('foreignObject').forEach(expandForeignObject);
  relaxTextSizing(svg);
  resetForeignObjectText(svg);

  return new XMLSerializer().serializeToString(svg);
}
