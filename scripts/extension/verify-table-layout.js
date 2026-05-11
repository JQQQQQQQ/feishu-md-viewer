async page => {
  await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, { timeout: 20000 });

  return await page.evaluate(() => {
    const host = document.querySelector('#feishu-md-viewer-host');
    const root = host?.shadowRoot;
    if (!root) throw new Error('Viewer host is missing.');

    const content = root.querySelector('.feishu-viewer__content');
    const contentRect = content?.getBoundingClientRect();

    return Array.from(root.querySelectorAll('.feishu-table-wrapper')).map((wrapper, index) => {
      const table = wrapper.querySelector('table');
      const columnCount = table
        ? Math.max(...Array.from(table.rows).map((row) => row.cells.length), 0)
        : 0;
      const wrapperRect = wrapper.getBoundingClientRect();
      const tableRect = table?.getBoundingClientRect();

      return {
        index,
        columnCount,
        className: wrapper.className,
        contentWidth: contentRect ? Math.round(contentRect.width) : null,
        wrapperWidth: Math.round(wrapperRect.width),
        tableWidth: tableRect ? Math.round(tableRect.width) : null,
        isRightWide: wrapper.classList.contains('feishu-table-wrapper--wide-right'),
        isBalancedWide: wrapper.classList.contains('feishu-table-wrapper--wide-balanced'),
        scrollWidth: wrapper.scrollWidth,
        clientWidth: wrapper.clientWidth,
      };
    });
  });
}
