import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createMarkdownSourceContext } from '@/lib/markdown-resource-resolver';
import { parseMarkdown } from '@/lib/markdown-pipeline';

describe('GitHub README HTML compatibility', () => {
  const githubContext = createMarkdownSourceContext(
    'github',
    'https://github.com/acme/docs/blob/main/guide/readme.md',
  );

  it('keeps safe presentation tags and media attributes', () => {
    const result = parseMarkdown(`
<details open>
  <summary>显示更多</summary>
  <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/dark.png 1x, ./assets/dark@2x.png 2x" />
    <img src="./assets/light.png" loading="lazy" decoding="async" width="320" height="180" alt="预览" />
  </picture>
  <video controls preload="metadata" poster="./assets/poster.png" src="./assets/demo.mp4"></video>
</details>`, githubContext);
    const { container } = render(result);

    expect(container.querySelector('details[open]')).not.toBeNull();
    expect(container.querySelector('details')?.classList.contains('feishu-details')).toBe(true);
    expect(container.querySelector('summary')?.textContent).toBe('显示更多');
    expect(container.querySelector('summary')?.classList.contains('feishu-summary')).toBe(true);
    expect(container.querySelectorAll('kbd')).toHaveLength(2);
    expect(container.querySelector('kbd')?.classList.contains('feishu-kbd')).toBe(true);
    expect(container.querySelector('picture source')?.getAttribute('srcset')).toBe(
      'https://raw.githubusercontent.com/acme/docs/main/guide/assets/dark.png 1x, https://raw.githubusercontent.com/acme/docs/main/guide/assets/dark@2x.png 2x',
    );
    expect(container.querySelector('picture img')?.getAttribute('src')).toBe(
      'https://raw.githubusercontent.com/acme/docs/main/guide/assets/light.png',
    );
    expect(container.querySelector('img[loading="lazy"]')?.getAttribute('decoding')).toBe('async');
    expect(container.querySelector('video[controls]')?.getAttribute('poster')).toBe(
      'https://raw.githubusercontent.com/acme/docs/main/guide/assets/poster.png',
    );
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      'https://raw.githubusercontent.com/acme/docs/main/guide/assets/demo.mp4',
    );
  });

  it('handles fragment links inside the current preview without opening a new tab', () => {
    const result = parseMarkdown('# 目标区块\n\n[跳转到目标](#目标区块)', githubContext);
    const { container } = render(result);
    const target = container.querySelector<HTMLElement>('[id="目标区块"]');
    const link = container.querySelector<HTMLAnchorElement>('a');
    const scrollIntoView = vi.fn();

    expect(target).not.toBeNull();
    expect(link).not.toBeNull();
    Object.defineProperty(target, 'scrollIntoView', { value: scrollIntoView });
    fireEvent.click(link as HTMLAnchorElement);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('sanitizes explicit HTML heading ids and resolves their internal anchors', () => {
    const result = parseMarkdown('<h2 id="internal-anchor">内部锚点目标</h2>\n\n[跳转](#internal-anchor)', githubContext);
    const { container } = render(result);
    const target = container.querySelector<HTMLElement>('#user-content-internal-anchor');
    const link = container.querySelector<HTMLAnchorElement>('a');
    const scrollIntoView = vi.fn();

    expect(target?.textContent).toContain('内部锚点目标');
    expect(target).not.toBeNull();
    expect(link).not.toBeNull();
    Object.defineProperty(target as HTMLElement, 'scrollIntoView', { value: scrollIntoView });
    fireEvent.click(link as HTMLAnchorElement);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('resolves README links and strips unsafe HTML', () => {
    const result = parseMarkdown(`
<div align="center" onclick="alert(1)">
  <a href="../setup.md#install">安装指南</a>
  <img src="javascript:alert(1)" onerror="alert(1)" alt="bad" />
  <script>alert(1)</script>
</div>`, githubContext);
    const { container } = render(result);

    expect(container.querySelector('div[onclick]')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      'https://github.com/acme/docs/blob/main/setup.md#install',
    );
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.querySelector('img[src^="javascript:"]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});
