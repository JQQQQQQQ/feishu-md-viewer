async page => {
  await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, { timeout: 20000 });

  return await page.evaluate(async () => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    if (!root) throw new Error('Viewer host is missing.');
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    if (root.querySelector('.feishu-viewer')?.getAttribute('data-mode') !== 'read') {
      root.querySelector('.feishu-topbar__mode-toggle')?.click();
      await wait(900);
    }

    const shell = root.querySelector('.feishu-app-shell');
    const sidebar = root.querySelector('.feishu-sidebar');
    const handle = root.querySelector('.feishu-sidebar__resize-handle');
    const main = root.querySelector('.feishu-app-shell__main');
    if (!shell || !sidebar || !handle || !main) throw new Error('Sidebar resize elements are missing.');

    const beforeSidebarWidth = Math.round(sidebar.getBoundingClientRect().width);
    const startX = sidebar.getBoundingClientRect().right - 2;
    handle.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      clientX: startX,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      pointerId: 1,
      clientX: startX + 92,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      pointerId: 1,
      clientX: startX + 92,
    }));
    await wait(120);
    const afterSidebarWidth = Math.round(sidebar.getBoundingClientRect().width);
    const mainMarginLeft = getComputedStyle(main).marginLeft;

    const tableWrapper = root.querySelector('.feishu-table-wrapper');
    const table = root.querySelector('.feishu-table');
    const content = root.querySelector('.feishu-viewer__content');
    const firstCell = table?.querySelector('th,td');
    if (!tableWrapper || !table || !(firstCell instanceof HTMLTableCellElement)) {
      throw new Error('Reading table is missing.');
    }

    const tableStyle = getComputedStyle(table);
    const wrapperStyle = getComputedStyle(tableWrapper);
    const cellRect = firstCell.getBoundingClientRect();
    const beforeCellWidth = Math.round(cellRect.width);
    const edgeX = cellRect.right - 2;
    const edgeY = cellRect.top + cellRect.height / 2;

    firstCell.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: edgeX,
      clientY: edgeY,
    }));
    firstCell.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: edgeX,
      clientY: edgeY,
    }));
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: edgeX + 64,
      clientY: edgeY,
    }));
    document.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      clientX: edgeX + 64,
      clientY: edgeY,
    }));
    await wait(120);
    const afterCellWidth = Math.round(firstCell.getBoundingClientRect().width);

    const tableCopyEvent = new Event('copy', { bubbles: true, cancelable: true });
    let copiedTableText = '';
    Object.defineProperty(tableCopyEvent, 'clipboardData', {
      value: {
        setData: (_type, value) => {
          copiedTableText = value;
        },
      },
    });

    firstCell.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: firstCell.getBoundingClientRect().left + 8,
      clientY: firstCell.getBoundingClientRect().top + 8,
    }));
    document.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'a',
      ctrlKey: true,
    }));
    document.dispatchEvent(tableCopyEvent);

    return {
      beforeSidebarWidth,
      afterSidebarWidth,
      mainMarginLeft,
      contentWidth: content ? Math.round(content.getBoundingClientRect().width) : null,
      wrapperWidth: Math.round(tableWrapper.getBoundingClientRect().width),
      tableLayout: tableStyle.tableLayout,
      tableWidth: tableStyle.width,
      tableMinWidth: tableStyle.minWidth,
      wrapperOverflowX: wrapperStyle.overflowX,
      wrapperScrollbarColor: wrapperStyle.scrollbarColor,
      beforeCellWidth,
      afterCellWidth,
      tableScrollWidth: tableWrapper.scrollWidth,
      wrapperClientWidth: tableWrapper.clientWidth,
      copiedTableText,
    };
  });
}
