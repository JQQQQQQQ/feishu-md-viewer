import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';

/**
 * Tests that edited content going through the sanitization pipeline is safe.
 * This simulates what parseMarkdown does: sanitize with ALLOWED_TAGS=[] and KEEP_CONTENT=true.
 */
function sanitizeEdited(content: string): string {
  return DOMPurify.sanitize(content, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
}

describe('XSS prevention for edited content', () => {
  it('script tags in edited markdown are stripped', () => {
    const malicious = 'Hello <script>alert("xss")</script> World';
    const result = sanitizeEdited(malicious);

    expect(result).not.toContain('<script');
    expect(result).not.toContain('</script>');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('event handlers (onerror, onclick) are stripped', () => {
    const withOnerror = '<img src="x" onerror="alert(1)"> text after';
    const resultOnerror = sanitizeEdited(withOnerror);
    expect(resultOnerror).not.toContain('onerror');
    expect(resultOnerror).toContain('text after');

    const withOnclick = '<div onclick="steal()">click me</div>';
    const resultOnclick = sanitizeEdited(withOnclick);
    expect(resultOnclick).not.toContain('onclick');
    expect(resultOnclick).toContain('click me');
  });

  it('javascript: URLs are stripped', () => {
    const jsUrl = '<a href="javascript:alert(document.cookie)">link</a>';
    const result = sanitizeEdited(jsUrl);
    expect(result).not.toContain('javascript:');
    expect(result).toContain('link');
  });
});
