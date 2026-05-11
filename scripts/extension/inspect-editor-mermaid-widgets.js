async page => {
  return await page.evaluate(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    if (!root) throw new Error('Viewer host is missing.');

    const widgets = Array.from(root.querySelectorAll('.feishu-editor-mermaid-widget')).map((widget, index) => ({
      index,
      hasSvg: Boolean(widget.querySelector('svg')),
      hasError: Boolean(widget.querySelector('.feishu-editor-mermaid-widget__error')),
      text: (widget.textContent || '').slice(0, 120),
      rect: {
        top: Math.round(widget.getBoundingClientRect().top),
        width: Math.round(widget.getBoundingClientRect().width),
        height: Math.round(widget.getBoundingClientRect().height),
      },
    }));

    const hiddenSources = Array.from(root.querySelectorAll('pre.feishu-editor-mermaid-source--hidden')).length;

    return {
      mode: root.querySelector('.feishu-viewer')?.getAttribute('data-mode') ?? null,
      widgetCount: widgets.length,
      svgCount: widgets.filter((widget) => widget.hasSvg).length,
      errorCount: widgets.filter((widget) => widget.hasError).length,
      hiddenSources,
      widgets,
    };
  });
}
