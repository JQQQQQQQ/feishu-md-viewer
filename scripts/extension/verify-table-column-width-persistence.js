async page => {
  const testUrl = 'https://github.com/JQQQQQQQ/feishu-md-viewer/blob/main/test-e2e.md';
  const storagePrefix = 'feishu-md-viewer:table-column-widths:v1';

  async function waitForViewer() {
    await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')?.shadowRoot), null, {
      timeout: 20000,
    });
    await page.waitForTimeout(800);
  }

  async function getTargetColumn() {
    return await page.evaluate(() => {
      const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
      if (!root) throw new Error('Viewer host is missing.');

      const wrappers = Array.from(root.querySelectorAll('.feishu-table-wrapper'));
      const wrapper = wrappers.find((item) => item.textContent?.includes('/root/workspace/intl-retail'));
      const table = wrapper?.querySelector('.feishu-table');
      const cell = table?.rows[0]?.cells[0];
      if (!wrapper || !table || !cell) throw new Error('Target table column is missing.');

      wrapper.scrollIntoView({ block: 'center', inline: 'nearest' });
      const rect = cell.getBoundingClientRect();
      return {
        x: Math.round(rect.right - 2),
        y: Math.round(rect.top + rect.height / 2),
        width: Math.round(rect.width),
        styleWidth: cell.style.width,
      };
    });
  }

  async function getFirstColumnWidths() {
    return await page.evaluate(() => {
      const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
      if (!root) throw new Error('Viewer host is missing.');

      const wrapper = Array.from(root.querySelectorAll('.feishu-table-wrapper'))
        .find((item) => item.textContent?.includes('/root/workspace/intl-retail'));
      const table = wrapper?.querySelector('.feishu-table');
      if (!table) throw new Error('Target table is missing.');

      const cells = Array.from(table.rows).map((row) => row.cells[0]).filter(Boolean);
      return cells.map((cell) => ({
        text: cell.textContent?.trim() ?? '',
        width: Math.round(cell.getBoundingClientRect().width),
        styleWidth: cell.style.width,
        minWidth: cell.style.minWidth,
      }));
    });
  }

  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await waitForViewer();
  await page.evaluate((prefix) => {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => window.localStorage.removeItem(key));
  }, storagePrefix);

  const before = await getTargetColumn();
  await page.mouse.move(before.x, before.y);
  await page.mouse.down();
  await page.mouse.move(before.x + 120, before.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const afterResize = await getFirstColumnWidths();
  const storedKeys = await page.evaluate((prefix) => Object.keys(window.localStorage).filter((key) => key.startsWith(prefix)), storagePrefix);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForViewer();
  const afterReload = await getFirstColumnWidths();

  return {
    before,
    afterResize,
    afterReload,
    storedKeyCount: storedKeys.length,
    persisted: afterReload.every((cell) => cell.styleWidth === afterResize[0].styleWidth && cell.minWidth === afterResize[0].minWidth),
  };
}
