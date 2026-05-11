async page => {
  await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, { timeout: 20000 });

  return await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    if (!root) throw new Error('Viewer host is missing.');

    const viewer = root.querySelector('.feishu-viewer');
    if (viewer?.getAttribute('data-mode') === 'edit') {
      root.querySelector('.feishu-topbar__mode-toggle')?.click();
      await wait(800);
    }

    const widget = root.querySelector('.feishu-editor-mermaid-widget');
    if (!(widget instanceof HTMLElement)) throw new Error('Mermaid widget is missing.');

    widget.scrollIntoView({ block: 'center' });
    await wait(500);

    widget.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }));
    widget.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, composed: true }));
    await wait(200);

    const toolbar = widget.querySelector('.feishu-editor-mermaid-widget__toolbar');
    const buttons = Array.from(widget.querySelectorAll('.feishu-editor-mermaid-widget__button'));
    const previewButton = buttons.find((button) => button.textContent === '预览');
    if (!(previewButton instanceof HTMLButtonElement)) throw new Error('Preview button is missing.');

    previewButton.click();
    await wait(500);

    const modal = root.querySelector('.mermaid-preview-overlay');
    const canvas = root.querySelector('.mermaid-preview-canvas');
    const zoom = root.querySelector('.mermaid-preview-toolbar__zoom')?.textContent?.trim() ?? '';
    root.querySelector('.mermaid-preview-toolbar__close')?.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      composed: true,
    }));
    await wait(200);

    return {
      mode: root.querySelector('.feishu-viewer')?.getAttribute('data-mode') ?? null,
      visibleButtons: buttons
        .filter((button) => getComputedStyle(button).display !== 'none')
        .map((button) => button.textContent),
      toolbarOpacity: toolbar ? getComputedStyle(toolbar).opacity : null,
      modalOpened: Boolean(modal),
      canvasFound: Boolean(canvas),
      zoom,
      modalClosed: !root.querySelector('.mermaid-preview-overlay'),
    };
  });
}
