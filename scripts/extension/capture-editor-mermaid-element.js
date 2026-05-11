async page => {
  const host = await page.waitForSelector('#feishu-md-viewer-host', { timeout: 10000 });
  await page.evaluate(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    const widget = root?.querySelector('.feishu-editor-mermaid-widget');
    widget?.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await page.waitForTimeout(800);

  const buffer = await host.evaluate(async (hostElement) => {
    const root = hostElement.shadowRoot;
    const widget = root?.querySelector('.feishu-editor-mermaid-widget');
    if (!widget) throw new Error('Mermaid widget is missing.');
    const rect = widget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.floor(rect.left)),
      y: Math.max(0, Math.floor(rect.top)),
      width: Math.max(1, Math.ceil(rect.width)),
      height: Math.max(1, Math.ceil(Math.min(rect.height, 700))),
    };
  });

  await page.screenshot({
    path: 'C:\\Users\\Q\\feishu-md-editor-mermaid-element.png',
    clip: buffer,
    timeout: 60000,
  });
  return 'C:\\Users\\Q\\feishu-md-editor-mermaid-element.png';
}
