import { describe, it, expect } from 'vitest';
import { isAllowedUrl } from '@/shared/utils/url-validation';

describe('isAllowedUrl (service worker URL validation)', () => {
  describe('accepts valid markdown sources', () => {
    it('accepts github.com .md URLs', () => {
      expect(isAllowedUrl('https://github.com/owner/repo/blob/main/README.md')).toBe(true);
    });

    it('accepts github.com .markdown URLs', () => {
      expect(isAllowedUrl('https://github.com/user/project/blob/dev/docs/guide.markdown')).toBe(true);
    });

    it('accepts gitlab.com .md URLs', () => {
      expect(isAllowedUrl('https://gitlab.com/group/repo/-/blob/main/README.md')).toBe(true);
    });

    it('accepts gitlab.com .markdown URLs', () => {
      expect(isAllowedUrl('https://gitlab.com/group/repo/-/blob/main/CHANGELOG.markdown')).toBe(true);
    });

    it('accepts file:// .md URLs', () => {
      expect(isAllowedUrl('file:///home/user/docs/readme.md')).toBe(true);
    });

    it('accepts file:// .markdown URLs', () => {
      expect(isAllowedUrl('file:///Users/dev/notes.markdown')).toBe(true);
    });

    it('accepts raw.githubusercontent.com .md URLs', () => {
      expect(isAllowedUrl('https://raw.githubusercontent.com/owner/repo/main/README.md')).toBe(true);
    });

    it('accepts raw.githubusercontent.com .markdown URLs', () => {
      expect(isAllowedUrl('https://raw.githubusercontent.com/owner/repo/main/docs/guide.markdown')).toBe(true);
    });
  });

  describe('rejects invalid URLs', () => {
    it('rejects random domains', () => {
      expect(isAllowedUrl('http://evil.com/payload.md')).toBe(false);
    });

    it('rejects https random domains', () => {
      expect(isAllowedUrl('https://malicious.io/hack.md')).toBe(false);
    });

    it('rejects URLs without .md extension on github', () => {
      expect(isAllowedUrl('https://github.com/owner/repo/blob/main/index.ts')).toBe(false);
    });

    it('rejects URLs without .md extension on gitlab', () => {
      expect(isAllowedUrl('https://gitlab.com/group/repo/-/blob/main/app.py')).toBe(false);
    });

    it('rejects file:// URLs without .md extension', () => {
      expect(isAllowedUrl('file:///home/user/docs/readme.txt')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isAllowedUrl('')).toBe(false);
    });

    it('rejects plain text (not a URL)', () => {
      expect(isAllowedUrl('not a url at all')).toBe(false);
    });

    it('rejects github.com without path to .md file', () => {
      expect(isAllowedUrl('https://github.com/owner/repo')).toBe(false);
    });

    it('rejects data: URLs with .md suffix', () => {
      expect(isAllowedUrl('data:text/plain;base64,test.md')).toBe(false);
    });
  });

  describe('case insensitivity', () => {
    it('accepts .MD (uppercase) extension', () => {
      expect(isAllowedUrl('file:///docs/README.MD')).toBe(true);
    });

    it('accepts .Markdown (mixed case) extension', () => {
      expect(isAllowedUrl('https://github.com/user/repo/blob/main/file.Markdown')).toBe(true);
    });
  });
});
