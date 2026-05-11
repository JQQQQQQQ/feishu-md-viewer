import DOMPurify from 'dompurify';
import { expandMermaidSvgBounds } from './mermaid-svg';

export function sanitizeMermaidSvg(svg: string): string {
  const expanded = expandMermaidSvgBounds(svg);
  return DOMPurify.sanitize(expanded, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
