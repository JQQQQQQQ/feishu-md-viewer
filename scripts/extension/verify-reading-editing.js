async page => {
  page.on('dialog', async (dialog) => {
    await dialog.dismiss();
  });

  const readState = await page.evaluate(async () => {
    const getRoot = () => document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    const root = getRoot();
    if (!root) throw new Error('Viewer host is missing.');

    const getButton = () => root.querySelector('.feishu-topbar__mode-toggle');
    const getContent = () => root.querySelector('.feishu-viewer__content');
    const getActions = () => root.querySelector('.feishu-topbar__actions');
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const mode = root.querySelector('.feishu-viewer')?.getAttribute('data-mode');
    if (mode === 'edit') {
      getButton()?.click();
      await wait(700);
    }

    window.scrollTo(0, 520);
    await wait(150);

    const contentRect = getContent()?.getBoundingClientRect();
    const actionsRect = getActions()?.getBoundingClientRect();

    return {
      mode: root.querySelector('.feishu-viewer')?.getAttribute('data-mode'),
      scrollY: window.scrollY,
      contentX: contentRect?.x ?? null,
      contentWidth: contentRect?.width ?? null,
      actionsX: actionsRect?.x ?? null,
      actionsWidth: actionsRect?.width ?? null,
    };
  });

  const editState = await page.evaluate(async () => {
    const getRoot = () => document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    const root = getRoot();
    if (!root) throw new Error('Viewer host is missing.');

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const getButton = () => root.querySelector('.feishu-topbar__mode-toggle');
    const getContent = () => root.querySelector('.feishu-viewer__content');
    const getActions = () => root.querySelector('.feishu-topbar__actions');

    getButton()?.click();
    await wait(900);

    const contentRect = getContent()?.getBoundingClientRect();
    const actionsRect = getActions()?.getBoundingClientRect();
    const editor = root.querySelector('.ProseMirror');
    const tableCell = root.querySelector('.ProseMirror table td, .ProseMirror table th');
    const cellStyle = tableCell ? getComputedStyle(tableCell) : null;
    const blocks = Array.from(root.querySelectorAll('.ProseMirror > *'))
      .slice(0, 24)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName,
          text: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 48),
          marginLeft: style.marginLeft,
          x: Math.round(rect.x),
          width: Math.round(rect.width),
        };
      });

    return {
      mode: root.querySelector('.feishu-viewer')?.getAttribute('data-mode'),
      scrollY: window.scrollY,
      contentX: contentRect?.x ?? null,
      contentWidth: contentRect?.width ?? null,
      actionsX: actionsRect?.x ?? null,
      actionsWidth: actionsRect?.width ?? null,
      hasEditor: Boolean(editor),
      tableBorderRight: cellStyle?.borderRightStyle ?? null,
      tableBorderRightWidth: cellStyle?.borderRightWidth ?? null,
      blocks,
    };
  });

  const toolbarState = await page.evaluate(async () => {
    const getRoot = () => document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    const root = getRoot();
    if (!root) throw new Error('Viewer host is missing.');

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const editor = root.querySelector('.ProseMirror');
    if (!(editor instanceof HTMLElement)) throw new Error('Editor is missing.');

    editor.focus();
    const paragraph = Array.from(editor.querySelectorAll('p'))
      .find((node) => (node.textContent || '').trim().length > 20);
    if (!paragraph) throw new Error('No selectable paragraph was found.');

    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const text = walker.nextNode();
    if (!text?.textContent) throw new Error('No selectable text was found.');

    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, Math.min(16, text.textContent.length));

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.dispatchEvent(new Event('selectionchange', { bubbles: true }));
    document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
    await wait(650);

    const toolbar = root.querySelector('.feishu-floating-toolbar');
    const buttons = toolbar ? Array.from(toolbar.querySelectorAll('button')) : [];

    for (let round = 0; round < 7; round += 1) {
      for (const button of buttons) {
        button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        await wait(35);
      }
    }

    await wait(220);

    return {
      visible: Boolean(root.querySelector('.feishu-floating-toolbar')),
      buttonCount: buttons.length,
      testedButtonCount: buttons.length,
      labels: buttons.map((button) => button.textContent?.trim()),
      activeElementTag: root.activeElement?.tagName ?? document.activeElement?.tagName ?? null,
    };
  });

  return {
    readState,
    editState,
    toolbarState,
    deltas: {
      scroll: Math.abs((editState.scrollY ?? 0) - (readState.scrollY ?? 0)),
      contentX: Math.abs((editState.contentX ?? 0) - (readState.contentX ?? 0)),
      contentWidth: Math.abs((editState.contentWidth ?? 0) - (readState.contentWidth ?? 0)),
      actionsX: Math.abs((editState.actionsX ?? 0) - (readState.actionsX ?? 0)),
      actionsWidth: Math.abs((editState.actionsWidth ?? 0) - (readState.actionsWidth ?? 0)),
    },
  };
}
