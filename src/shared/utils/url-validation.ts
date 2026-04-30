/**
 * URL validation utilities for the Feishu MD Viewer extension.
 * Determines whether a given URL points to an allowed markdown source.
 */

const ALLOWED_URL_PATTERNS = [
  /^file:\/\/.+\.(md|markdown)$/i,
  /^https:\/\/github\.com\/.+\.(md|markdown)$/i,
  /^https:\/\/gitlab\.com\/.+\.(md|markdown)$/i,
  /^https:\/\/raw\.githubusercontent\.com\/.+\.(md|markdown)$/i,
];

/**
 * Validates that a URL is an allowed markdown source.
 * Accepts file://, github.com, gitlab.com, and raw.githubusercontent.com URLs
 * that end with .md or .markdown extension.
 */
export function isAllowedUrl(url: string): boolean {
  return ALLOWED_URL_PATTERNS.some((pattern) => pattern.test(url));
}
