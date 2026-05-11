async page => {
  await page.waitForTimeout(1500);
  return await page.evaluate(() => {
    const host = document.querySelector('#feishu-md-viewer-host');
    const root = host?.shadowRoot;
    const viewer = root?.querySelector('.feishu-viewer');
    return {
      hasHost: Boolean(host),
      hasRoot: Boolean(root),
      mode: viewer?.getAttribute('data-mode') ?? null,
      mermaidPreviewCount: root?.querySelectorAll('.feishu-editor-mermaid-preview').length ?? 0,
      mermaidPreCount: root?.querySelectorAll('.ProseMirror pre[data-feishu-mermaid-block-id]').length ?? 0,
      title: document.title,
      url: location.href,
    };
  });
}
