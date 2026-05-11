async page => {
  return await page.evaluate(async () => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    if (!root) throw new Error('Viewer host is missing.');

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    if (root.querySelector('.feishu-viewer')?.getAttribute('data-mode') !== 'edit') {
      root.querySelector('.feishu-topbar__mode-toggle')?.click();
      await wait(900);
    }

    const getAttrs = (element) => Array.from(element.attributes).map((attr) => [attr.name, attr.value]);
    const pre = root.querySelector('.ProseMirror pre');
    const table = root.querySelector('.ProseMirror table');
    const blockquotes = Array.from(root.querySelectorAll('.ProseMirror blockquote')).slice(0, 6);

    return {
      pre: pre ? {
        html: pre.outerHTML.slice(0, 900),
        attrs: getAttrs(pre),
        text: pre.textContent?.slice(0, 140),
      } : null,
      table: table ? {
        html: table.outerHTML.slice(0, 700),
        attrs: getAttrs(table),
      } : null,
      blockquotes: blockquotes.map((blockquote) => ({
        html: blockquote.outerHTML.slice(0, 700),
        attrs: getAttrs(blockquote),
        text: blockquote.textContent?.replace(/\s+/g, ' ').trim().slice(0, 140),
      })),
    };
  });
}
