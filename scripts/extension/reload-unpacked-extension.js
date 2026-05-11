async page => {
  const extensionsPage = await page.context().newPage();
  await extensionsPage.goto('chrome://extensions/');
  await extensionsPage.waitForTimeout(1200);

  const result = await extensionsPage.evaluate(async () => {
    const manager = document.querySelector('extensions-manager');
    const managerRoot = manager?.shadowRoot;
    const itemList = managerRoot?.querySelector('extensions-item-list');
    const listRoot = itemList?.shadowRoot;
    const items = Array.from(listRoot?.querySelectorAll('extensions-item') ?? []);

    const summaries = items.map((item) => {
      const root = item.shadowRoot;
      return {
        id: item.getAttribute('id'),
        name: root?.querySelector('#name')?.textContent?.trim() ?? '',
      };
    });

    const target = items.find((item) => {
      const name = item.shadowRoot?.querySelector('#name')?.textContent?.trim() ?? '';
      return /feishu|md viewer|markdown/i.test(name);
    });

    if (!target) return { reloaded: false, summaries };

    const reloadButton = target.shadowRoot?.querySelector('#dev-reload-button');
    if (!(reloadButton instanceof HTMLElement)) return { reloaded: false, summaries, reason: 'reload button missing' };

    reloadButton.click();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return { reloaded: true, summaries };
  });

  await extensionsPage.close();
  return result;
}
