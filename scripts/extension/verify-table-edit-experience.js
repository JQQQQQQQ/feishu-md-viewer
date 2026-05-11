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

    const firstCell = table.rows[1]?.cells[0];
    if (!firstCell) throw new Error('First table cell is missing.');

    const firstRect = firstCell.getBoundingClientRect();
    firstCell.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
      clientX: firstRect.left + 8,
      clientY: firstRect.top + 8,
    }));
    document.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: firstRect.left + 8,
      clientY: firstRect.top + 8,
    }));
    const readSelectedCells = table.querySelectorAll('.feishu-table__cell--selected').length;
    const modeAfterReadClick = root.querySelector('.feishu-viewer')?.getAttribute('data-mode') ?? null;

    firstCell.dispatchEvent(new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
      clientX: firstRect.left + 10,
      clientY: firstRect.top + 10,
    }));
    await wait(900);

    const editMode = root.querySelector('.feishu-viewer')?.getAttribute('data-mode') ?? null;
    const editable = root.querySelector('.feishu-wysiwyg')?.getAttribute('data-editable') ?? null;
    const selectedAfterEdit = table.querySelectorAll('.feishu-table__cell--selected,.feishu-table__header--selected').length;
    const proseMirror = root.querySelector('.ProseMirror');
    const selection = root.getSelection?.() ?? window.getSelection();

    firstCell.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
      clientX: firstRect.left + 12,
      clientY: firstRect.top + 12,
    }));
    firstCell.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: firstRect.left + 12,
      clientY: firstRect.top + 12,
    }));
    await wait(200);

    return {
      modeAfterReadClick,
      readSelectedCells,
      editMode,
      editable,
      selectedAfterEdit,
      editorFocused: root.activeElement === proseMirror,
      selectionInsideTable: Boolean(selection?.anchorNode && table.contains(selection.anchorNode)),
      tableDisplay: getComputedStyle(table).display,
    };
  });
}
