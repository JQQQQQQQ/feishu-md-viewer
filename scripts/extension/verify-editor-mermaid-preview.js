async page => {
  await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, { timeout: 10000 });

  const result = await page.evaluate(async () => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    if (!root) throw new Error('Viewer host is missing.');

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const viewer = root.querySelector('.feishu-viewer');
    if (viewer?.getAttribute('data-mode') !== 'edit') {
      root.querySelector('.feishu-topbar__mode-toggle')?.click();
      await wait(1200);
    }

    const mermaidPre = Array.from(root.querySelectorAll('.ProseMirror pre'))
      .find((pre) => (pre.getAttribute('data-language') || '').toLowerCase() === 'mermaid');
    mermaidPre?.scrollIntoView({ block: 'center' });
    await wait(2000);

    const previews = Array.from(root.querySelectorAll('.feishu-editor-mermaid-widget'));
    const preview = previews[0];
    const preState = mermaidPre ? {
      language: mermaidPre.getAttribute('data-language'),
      display: getComputedStyle(mermaidPre).display,
      className: mermaidPre.className,
    } : null;

    return {
      mode: root.querySelector('.feishu-viewer')?.getAttribute('data-mode') ?? null,
      mermaidPreFound: Boolean(mermaidPre),
      previewCount: previews.length,
      hasSvg: Boolean(preview?.querySelector('svg')),
      hasError: Boolean(preview?.querySelector('.feishu-editor-mermaid-widget__error')),
      preState,
      previewRect: preview ? {
        width: Math.round(preview.getBoundingClientRect().width),
        height: Math.round(preview.getBoundingClientRect().height),
      } : null,
    };
  });

  await page.screenshot({ path: 'C:\\Users\\Q\\feishu-md-editor-mermaid-preview.png', fullPage: false });
  return result;
}
