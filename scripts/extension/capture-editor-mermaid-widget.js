async page => {
  await page.evaluate(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    const widget = root?.querySelector('.feishu-editor-mermaid-widget');
    widget?.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'C:\\Users\\Q\\feishu-md-editor-mermaid-widget.png',
    fullPage: false,
    timeout: 60000,
  });
  return 'C:\\Users\\Q\\feishu-md-editor-mermaid-widget.png';
}
