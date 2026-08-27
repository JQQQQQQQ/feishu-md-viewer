import { describe, expect, it } from 'vitest';
import {
  createMarkdownSourceContext,
  resolveMarkdownSrcSet,
  resolveMarkdownUrl,
} from '@/lib/markdown-resource-resolver';

describe('Markdown source-aware resource resolver', () => {
  const fileContext = createMarkdownSourceContext('file', 'file:///docs/readme.md');
  const githubBlobContext = createMarkdownSourceContext(
    'github',
    'https://github.com/acme/docs/blob/main/guide/readme.md',
  );
  const githubRawContext = createMarkdownSourceContext(
    'github',
    'https://raw.githubusercontent.com/acme/docs/main/guide/readme.md',
  );
  const gitlabBlobContext = createMarkdownSourceContext(
    'gitlab',
    'https://gitlab.com/acme/docs/-/blob/main/guide/readme.md',
  );

  it('resolves local relative assets against the Markdown directory', () => {
    expect(resolveMarkdownUrl('./assets/demo.png', fileContext, 'asset')).toBe('file:///docs/assets/demo.png');
  });

  it('uses GitHub blob for relative links and raw for relative assets', () => {
    expect(resolveMarkdownUrl('../guide/setup.md', githubBlobContext, 'link')).toBe(
      'https://github.com/acme/docs/blob/main/guide/setup.md',
    );
    expect(resolveMarkdownUrl('./assets/demo.png', githubBlobContext, 'asset')).toBe(
      'https://raw.githubusercontent.com/acme/docs/main/guide/assets/demo.png',
    );
  });

  it('resolves raw GitHub and GitLab blob contexts', () => {
    expect(resolveMarkdownUrl('../img/a.png', githubRawContext, 'asset')).toBe(
      'https://raw.githubusercontent.com/acme/docs/main/img/a.png',
    );
    expect(resolveMarkdownUrl('./img/a.png', gitlabBlobContext, 'asset')).toBe(
      'https://gitlab.com/acme/docs/-/raw/main/guide/img/a.png',
    );
  });

  it('preserves fragments, safe absolute URLs and query strings', () => {
    expect(resolveMarkdownUrl('#html-table', fileContext, 'link')).toBe('#html-table');
    expect(resolveMarkdownUrl('https://example.com/a.png?v=1#preview', fileContext, 'asset')).toBe(
      'https://example.com/a.png?v=1#preview',
    );
    expect(resolveMarkdownUrl('mailto:maintainer@example.com', fileContext, 'link')).toBe(
      'mailto:maintainer@example.com',
    );
  });

  it('rejects dangerous protocols without throwing', () => {
    expect(resolveMarkdownUrl('javascript:alert(1)', fileContext, 'link')).toBeNull();
    expect(resolveMarkdownUrl('vbscript:msgbox(1)', fileContext, 'link')).toBeNull();
    expect(resolveMarkdownUrl('data:image/png;base64,AAAA', fileContext, 'asset')).toBeNull();
    expect(() => resolveMarkdownUrl('%zz', fileContext, 'asset')).not.toThrow();
  });

  it('resolves every srcset candidate and preserves descriptors', () => {
    expect(resolveMarkdownSrcSet('./light.png 1x, ../wide.png 2x', githubBlobContext)).toBe(
      'https://raw.githubusercontent.com/acme/docs/main/guide/light.png 1x, https://raw.githubusercontent.com/acme/docs/main/wide.png 2x',
    );
  });

  it('allows the VS Code Webview resource protocol only for its runtime context', () => {
    const webviewContext = {
      ...fileContext,
      runtime: 'vscode-webview' as const,
      assetBaseUrl: 'vscode-webview-resource://preview/file///docs/',
    };
    expect(resolveMarkdownUrl('./assets/demo.png', webviewContext, 'asset')).toBe(
      'vscode-webview-resource://preview/file///docs/assets/demo.png',
    );
    expect(resolveMarkdownUrl('vscode-webview-resource://preview/file///docs/a.png', fileContext, 'asset')).toBeNull();
  });

  it('leaves relative URLs unchanged when no source context is provided', () => {
    expect(resolveMarkdownUrl('./assets/demo.png', undefined, 'asset')).toBe('./assets/demo.png');
  });
});
