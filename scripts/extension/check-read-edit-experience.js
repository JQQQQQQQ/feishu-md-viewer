async page => {
  const testUrl = 'https://github.com/JQQQQQQQ/feishu-md-viewer/blob/main/test-e2e.md';

  async function waitForViewer() {
    await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')?.shadowRoot), null, {
      timeout: 20000,
    });
    await page.waitForTimeout(1000);
  }

  async function getSnapshot(label) {
    return await page.evaluate((snapshotLabel) => {
      const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
      if (!root) throw new Error('Viewer host is missing.');

      const viewer = root.querySelector('.feishu-viewer');
      const content = root.querySelector('.feishu-viewer__content');
      const readBody = root.querySelector('.feishu-markdown-body');
      const editor = root.querySelector('.ProseMirror');
      const firstHeading = root.querySelector('.feishu-heading, .ProseMirror h1, .ProseMirror h2');
      const firstParagraph = root.querySelector('.feishu-markdown-body p, .ProseMirror p');
      const firstTable = root.querySelector('.feishu-table-wrapper, .ProseMirror table');
      const mermaid = root.querySelector('.mermaid-block, .feishu-editor-mermaid-widget');

      function rectOf(node) {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }

      function styleOf(node) {
        if (!node) return null;
        const style = getComputedStyle(node);
        return {
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          color: style.color,
          marginTop: style.marginTop,
          marginBottom: style.marginBottom,
          paddingLeft: style.paddingLeft,
          backgroundColor: style.backgroundColor,
        };
      }

      return {
        label: snapshotLabel,
        viewerMode: viewer?.getAttribute('data-mode') ?? null,
        contentMode: content?.getAttribute('data-mode') ?? null,
        hasReadBody: Boolean(readBody),
        hasEditor: Boolean(editor),
        editorEditable: editor?.getAttribute('contenteditable') ?? null,
        contentRect: rectOf(content),
        firstHeadingRect: rectOf(firstHeading),
        firstHeadingStyle: styleOf(firstHeading),
        firstParagraphStyle: styleOf(firstParagraph),
        firstTableRect: rectOf(firstTable),
        tableCount: root.querySelectorAll('.feishu-table-wrapper, .ProseMirror table').length,
        mermaidCount: root.querySelectorAll('.mermaid-block, .feishu-editor-mermaid-widget').length,
      };
    }, label);
  }

  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await waitForViewer();
  const readSnapshot = await getSnapshot('read');

  await page.evaluate(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    const button = Array.from(root?.querySelectorAll('button') ?? [])
      .find((item) => item.textContent?.trim() === '编辑');
    if (!button) throw new Error('Edit button is missing.');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    return Boolean(root?.querySelector('.ProseMirror'));
  }, null, { timeout: 20000 });
  await page.waitForTimeout(1500);

  const editSnapshot = await getSnapshot('edit');
  const editableTextResult = await page.evaluate(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    const paragraph = root?.querySelector('.ProseMirror p');
    if (!(paragraph instanceof HTMLElement)) return { ok: false, reason: 'No editable paragraph.' };
    paragraph.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const selection = root?.getSelection?.() ?? window.getSelection();
    return {
      ok: true,
      activeTag: root?.activeElement?.tagName ?? document.activeElement?.tagName ?? null,
      hasSelection: Boolean(selection && selection.rangeCount > 0),
      paragraphText: paragraph.textContent?.slice(0, 80) ?? '',
    };
  });

  return { readSnapshot, editSnapshot, editableTextResult };
}
