async page => {
  return await page.evaluate(async () => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    if (!root) throw new Error('Viewer host is missing.');

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const widget = root.querySelector('.feishu-editor-mermaid-widget');
    if (!widget) throw new Error('Mermaid widget is missing.');

    widget.scrollIntoView({ block: 'center', inline: 'nearest' });
    await wait(300);
    widget.querySelector('button')?.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
    }));
    await wait(500);

    const hiddenSources = root.querySelectorAll('pre.feishu-editor-mermaid-source--hidden').length;
    const visibleMermaidSource = Array.from(root.querySelectorAll('.ProseMirror pre'))
      .find((pre) => (pre.getAttribute('data-language') || '').toLowerCase() === 'mermaid'
        && !pre.classList.contains('feishu-editor-mermaid-source--hidden'));

    return {
      hiddenSources,
      hasVisibleMermaidSource: Boolean(visibleMermaidSource),
      visibleSourceText: (visibleMermaidSource?.textContent || '').slice(0, 80),
      activeElement: root.activeElement?.tagName ?? document.activeElement?.tagName ?? null,
    };
  });
}
