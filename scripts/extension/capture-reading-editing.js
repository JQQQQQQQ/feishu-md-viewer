async page => {
  const testUrl = 'https://github.com/JQQQQQQQ/feishu-md-viewer/blob/main/test-e2e.md';

  await page.setViewportSize({ width: 1728, height: 1040 });
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, { timeout: 10000 });
  await page.waitForTimeout(1200);

  const ensureMode = async (targetMode) => {
    await page.evaluate(async (targetMode) => {
      const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
      if (!root) throw new Error('Viewer host is missing.');

      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const viewer = root.querySelector('.feishu-viewer');
      const mode = viewer?.getAttribute('data-mode');
      if (mode !== targetMode) {
        root.querySelector('.feishu-topbar__mode-toggle')?.click();
        await wait(900);
      }
    }, targetMode);
  };

  await ensureMode('read');
  await page.evaluate(() => window.scrollTo(0, 420));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:\\Users\\Q\\feishu-md-reading.png', fullPage: false });

  await ensureMode('edit');
  await page.evaluate(() => window.scrollTo(0, 420));
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'C:\\Users\\Q\\feishu-md-editing.png', fullPage: false });

  return {
    reading: 'C:\\Users\\Q\\feishu-md-reading.png',
    editing: 'C:\\Users\\Q\\feishu-md-editing.png',
  };
}
