async page => {
  await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')), null, { timeout: 20000 });
  return await page.evaluate(() => {
    const root = document.querySelector('#feishu-md-viewer-host')?.shadowRoot;
    const firstTool = root?.querySelector('.feishu-editor-code-tools');
    const firstButton = root?.querySelector('.feishu-editor-code-tools__copy');
    const firstPre = root?.querySelector('.feishu-editor-code-tools + pre');

    return {
      tools: root?.querySelectorAll('.feishu-editor-code-tools').length ?? 0,
      firstButtonText: firstButton?.textContent ?? null,
      firstToolDisplay: firstTool ? getComputedStyle(firstTool).display : null,
      firstPreText: firstPre?.textContent?.slice(0, 32) ?? null,
    };
  });
}
