async page => {
  const testUrl = 'https://github.com/JQQQQQQQ/feishu-md-viewer/blob/main/test-e2e.md';

  async function waitForEditor() {
    await page.waitForFunction(() => {
      const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
      return Boolean(root?.querySelector('.ProseMirror'));
    }, null, { timeout: 20000 });
    await page.waitForTimeout(1000);
  }

  async function snapshot(label) {
    return await page.evaluate((snapshotLabel) => {
      const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
      if (!root) throw new Error('Viewer host is missing.');

      const viewer = root.querySelector('.feishu-viewer');
      const surface = root.querySelector('.feishu-wysiwyg');
      const editor = root.querySelector('.ProseMirror');
      const heading = root.querySelector('.ProseMirror h1, .ProseMirror h2');
      const paragraph = root.querySelector('.ProseMirror p');
      const table = root.querySelector('.ProseMirror table');

      if (editor) {
        if (!editor.getAttribute('data-single-dom-id')) {
          editor.setAttribute('data-single-dom-id', `pm-${Date.now()}`);
        }
      }

      function rectOf(node) {
        const rect = node?.getBoundingClientRect();
        if (!rect) return null;
        return {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }

      return {
        label: snapshotLabel,
        viewerMode: viewer?.getAttribute('data-mode') ?? null,
        surfaceEditable: surface?.getAttribute('data-editable') ?? null,
        hasMarkdownRenderer: Boolean(root.querySelector('.feishu-markdown-body')),
        editorId: editor?.getAttribute('data-single-dom-id') ?? null,
        editorEditable: editor?.getAttribute('contenteditable') ?? null,
        headingRect: rectOf(heading),
        paragraphRect: rectOf(paragraph),
        tableRect: rectOf(table),
      };
    }, label);
  }

  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await waitForEditor();
  const read = await snapshot('read');

  await page.evaluate(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    const paragraph = root?.querySelector('.ProseMirror p');
    if (!(paragraph instanceof HTMLElement)) throw new Error('Editable paragraph is missing.');
    paragraph.scrollIntoView({ block: 'center' });
  });

  const clickPoint = await page.evaluate(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    const paragraph = root?.querySelector('.ProseMirror p');
    if (!(paragraph instanceof HTMLElement)) throw new Error('Editable paragraph is missing.');
    const rect = paragraph.getBoundingClientRect();
    return { x: Math.round(rect.left + 80), y: Math.round(rect.top + rect.height / 2) };
  });

  await page.mouse.click(clickPoint.x, clickPoint.y);
  await page.waitForFunction(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    return root?.querySelector('.feishu-viewer')?.getAttribute('data-mode') === 'edit';
  }, null, { timeout: 5000 });
  await page.waitForTimeout(400);
  const edit = await snapshot('edit-after-click');

  const focus = await page.evaluate(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    const editor = root?.querySelector('.ProseMirror');
    const selection = root?.getSelection?.() ?? window.getSelection();
    return {
      editorFocused: editor === root?.activeElement || editor?.matches(':focus') || editor?.contains(root?.activeElement ?? null),
      hasSelection: Boolean(selection && selection.rangeCount > 0),
    };
  });

  return {
    read,
    edit,
    focus,
    sameEditorNode: Boolean(read.editorId && read.editorId === edit.editorId),
    noMarkdownRenderer: !read.hasMarkdownRenderer && !edit.hasMarkdownRenderer,
  };
}
