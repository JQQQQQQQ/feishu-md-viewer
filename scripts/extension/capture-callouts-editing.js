async page => {
  const testUrl = 'https://github.com/JQQQQQQQ/feishu-md-viewer/blob/main/test-e2e.md';

  await page.setViewportSize({ width: 1728, height: 1040 });
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, { timeout: 10000 });
  await page.waitForTimeout(1200);

  await page.evaluate(async () => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    if (!root) throw new Error('Viewer host is missing.');
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    if (root.querySelector('.feishu-viewer')?.getAttribute('data-mode') !== 'edit') {
      root.querySelector('.feishu-topbar__mode-toggle')?.click();
      await wait(900);
    }

    const callout = Array.from(root.querySelectorAll('.ProseMirror blockquote'))
      .find((node) => /^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i.test(node.textContent || ''));
    if (!callout) throw new Error('Callout blockquote is missing in editor mode.');

    callout.scrollIntoView({ block: 'center', inline: 'nearest' });
  });

  await page.waitForTimeout(700);
  await page.screenshot({ path: 'C:\\Users\\Q\\feishu-md-editing-callouts.png', fullPage: false });
  return 'C:\\Users\\Q\\feishu-md-editing-callouts.png';
}
