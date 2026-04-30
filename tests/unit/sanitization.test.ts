import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';

describe('sanitization', () => {
  describe('DOMPurify markdown source sanitization', () => {
    it('strips script tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = DOMPurify.sanitize(input, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
      expect(result).not.toContain('<script');
      expect(result).toContain('Hello');
    });

    it('strips event handlers', () => {
      const input = '<img src=x onerror=alert(1)>Hello';
      const result = DOMPurify.sanitize(input, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
      expect(result).not.toContain('onerror');
      expect(result).toContain('Hello');
    });

    it('strips iframe tags', () => {
      const input = '<iframe src="evil.com"></iframe>Content';
      const result = DOMPurify.sanitize(input, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
      expect(result).not.toContain('<iframe');
      expect(result).toContain('Content');
    });

    it('strips javascript: URLs', () => {
      const input = '<a href="javascript:alert(1)">click</a>';
      const result = DOMPurify.sanitize(input, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
      expect(result).not.toContain('javascript:');
    });
  });

  describe('DOMPurify SVG sanitization', () => {
    it('allows valid SVG elements', () => {
      const svg = '<svg><rect width="100" height="100"/></svg>';
      const result = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
      expect(result).toContain('<svg');
      expect(result).toContain('<rect');
    });

    it('strips scripts from SVG', () => {
      const svg = '<svg><script>alert(1)</script><rect/></svg>';
      const result = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
      expect(result).not.toContain('<script');
    });

    it('strips event handlers from SVG', () => {
      const svg = '<svg onload="alert(1)"><rect/></svg>';
      const result = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
      expect(result).not.toContain('onload');
    });
  });
});
