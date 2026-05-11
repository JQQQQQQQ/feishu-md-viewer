async page => {
  await page.waitForTimeout(1800);
  return await page.evaluate(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    const pm = root?.querySelector('.ProseMirror');
    const measure = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        className: String(element.className || ''),
        text: (element.innerText || '').slice(0, 96),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        display: style.display,
        overflowX: style.overflowX,
      };
    };

    return {
      hasRoot: Boolean(root),
      mode: root?.querySelector('.feishu-viewer')?.getAttribute('data-mode') ?? null,
      contentWidth: Math.round(root?.querySelector('.feishu-viewer__content')?.getBoundingClientRect().width ?? 0),
      editorWidth: Math.round(pm?.getBoundingClientRect().width ?? 0),
      counts: {
        headings: root?.querySelectorAll('h1,h2,h3,h4,h5,h6').length ?? 0,
        tables: root?.querySelectorAll('table').length ?? 0,
        pre: root?.querySelectorAll('pre').length ?? 0,
        codeBlocks: root?.querySelectorAll('.feishu-editor-code-block').length ?? 0,
        mermaidWidgets: root?.querySelectorAll('.feishu-editor-mermaid-widget').length ?? 0,
        mermaidButtons: root?.querySelectorAll('.feishu-editor-mermaid-widget__button').length ?? 0,
        images: root?.querySelectorAll('img').length ?? 0,
        blockquotes: root?.querySelectorAll('blockquote').length ?? 0,
      },
      topBlocks: pm ? Array.from(pm.children).slice(0, 24).map(measure) : [],
      mermaidButtons: Array.from(root?.querySelectorAll('.feishu-editor-mermaid-widget__button') ?? [])
        .map((button) => button.textContent),
      tables: Array.from(root?.querySelectorAll('table') ?? []).slice(0, 8).map(measure),
      codeBlocks: Array.from(root?.querySelectorAll('pre') ?? []).slice(0, 12).map(measure),
    };
  });
}
