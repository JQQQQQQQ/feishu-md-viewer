async page => {
  return await page.evaluate(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    if (!root) throw new Error('Viewer host is missing.');

    const pres = Array.from(root.querySelectorAll('.ProseMirror pre')).map((pre, index) => ({
      index,
      language: pre.getAttribute('data-language'),
      blockId: pre.getAttribute('data-feishu-mermaid-block-id'),
      previewState: pre.getAttribute('data-feishu-mermaid-preview'),
      textStart: (pre.textContent || '').slice(0, 80),
      rect: {
        top: Math.round(pre.getBoundingClientRect().top),
        height: Math.round(pre.getBoundingClientRect().height),
      },
    }));

    const previews = Array.from(root.querySelectorAll('.feishu-editor-mermaid-preview')).map((preview, index) => ({
      index,
      hidden: preview.classList.contains('feishu-editor-mermaid-preview--hidden'),
      hasSvg: Boolean(preview.querySelector('svg')),
      text: (preview.textContent || '').slice(0, 120),
      rect: {
        top: Math.round(preview.getBoundingClientRect().top),
        height: Math.round(preview.getBoundingClientRect().height),
      },
    }));

    return { pres, previews };
  });
}
