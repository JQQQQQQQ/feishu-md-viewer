async page => {
  await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, { timeout: 20000 });

  return await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    if (!root) throw new Error('Viewer host is missing.');

    if (root.querySelector('.feishu-viewer')?.getAttribute('data-mode') !== 'read') {
      root.querySelector('.feishu-topbar__mode-toggle')?.click();
      await wait(800);
    }

    const table = root.querySelector('.ProseMirror table');
    if (!(table instanceof HTMLTableElement)) throw new Error('Editor table is missing.');

    table.scrollIntoView({ block: 'center' });
    await wait(200);

    const rows = Array.from(table.rows);
    const first = rows[1]?.cells[0];
    const last = rows[Math.min(3, rows.length - 1)]?.cells[0];
    if (!first || !last) throw new Error('Not enough table cells to verify selection.');

    const start = first.getBoundingClientRect();
    const end = last.getBoundingClientRect();
    first.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
      clientX: start.left + 8,
      clientY: start.top + 8,
    }));
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: end.left + 8,
      clientY: end.top + 8,
    }));
    last.dispatchEvent(new MouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: end.left + 8,
      clientY: end.top + 8,
    }));
    document.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: end.left + 8,
      clientY: end.top + 8,
    }));

    const selectedRows = Array.from(table.rows)
      .map((row) => Array.from(row.cells)
        .filter((cell) => cell.classList.contains('feishu-table__header--selected')
          || cell.classList.contains('feishu-table__cell--selected'))
        .map((cell) => cell.textContent.trim()))
      .filter((row) => row.length > 0);

    return {
      mode: root.querySelector('.feishu-viewer')?.getAttribute('data-mode') ?? null,
      selectedHeaders: table.querySelectorAll('th.feishu-table__header--selected').length,
      selectedCells: table.querySelectorAll('td.feishu-table__cell--selected').length,
      selectedText: selectedRows.map((row) => row.join('\t')).join('\n'),
      tableDisplay: getComputedStyle(table).display,
      tableOverflowX: getComputedStyle(table).overflowX,
    };
  });
}
