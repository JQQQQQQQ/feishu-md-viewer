import { expect, test } from '@playwright/test';
import {
  createBrowserContext,
  createTempMarkdownFixture,
  setViewerSettings,
  waitForViewer,
  viewerLocator,
} from './helpers';

test.describe('浏览器 Markdown 预览', () => {
  test('GitHub README 常见 HTML 结构和相对链接可安全预览', async () => {
    const fixture = await createTempMarkdownFixture(undefined, 'markdown-compatibility');
    const context = await createBrowserContext();
    try {
      const page = await context.newPage();
      await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
      await waitForViewer(page);

      const article = viewerLocator(page, '[role="article"]');
      await expect(article).toContainText('GitHub Markdown 兼容性测试文档');
      await expect(viewerLocator(page, 'details')).toHaveCount(2);
      await expect(viewerLocator(page, 'picture source')).toHaveCount(2);
      await expect(viewerLocator(page, 'kbd')).toHaveCount(2);
      await expect(viewerLocator(page, 'video')).toHaveCount(1);
      await expect(viewerLocator(page, '.feishu-table:not(.feishu-table--sticky-clone):not(.feishu-table--left-reveal-clone)')).toHaveCount(2);
      await expect(viewerLocator(page, 'a[href^="file:"]')).toHaveCount(3);

      const internalLink = viewerLocator(page, 'a').filter({ hasText: '跳到内部锚点' });
      await internalLink.click();
      await expect(viewerLocator(page, '#internal-anchor')).toBeInViewport();
    } finally {
      await context.close();
      await fixture.cleanup();
    }
  });

  test('本地 Markdown 文件进入 Feishu 预览', async () => {
    const fixture = await createTempMarkdownFixture();
    const context = await createBrowserContext();
    try {
      const page = await context.newPage();
      await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
      await waitForViewer(page);

      await expect(viewerLocator(page, '.feishu-viewer')).toHaveAttribute('data-mode', 'read');
      await expect(viewerLocator(page, '[role="article"]')).toContainText('发布验收 Fixture');
      await expect(viewerLocator(page, '.feishu-toc')).toBeVisible();
      await expect(viewerLocator(page, '.feishu-table:not(.feishu-table--sticky-clone):not(.feishu-table--left-reveal-clone)')).toHaveCount(2);
      await expect(viewerLocator(page, '.feishu-code-block__pre')).toHaveCount(1);
    } finally {
      await context.close();
      await fixture.cleanup();
    }
  });

  test('目录定位准确且折叠目录不改变正文布局', async () => {
    const fixture = await createTempMarkdownFixture();
    const context = await createBrowserContext();
    try {
      const page = await context.newPage();
      await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
      await waitForViewer(page);

      const content = viewerLocator(page, '.feishu-viewer__content');
      const before = await content.boundingBox();
      await viewerLocator(page, '.feishu-toc [role="link"]').filter({ hasText: '目录目标标题' }).click();
      await expect(viewerLocator(page, '#目录目标标题')).toBeInViewport();

      await viewerLocator(page, 'button[aria-label="Close navigation"]').click();
      const after = await content.boundingBox();
      expect(after?.x).toBe(before?.x);
      await expect(viewerLocator(page, '.feishu-sidebar')).toHaveAttribute('aria-hidden', 'true');
    } finally {
      await context.close();
      await fixture.cleanup();
    }
  });

  test('Mermaid 正常图和错误图分别显示图表与降级状态', async () => {
    const fixture = await createTempMarkdownFixture();
    const context = await createBrowserContext();
    try {
      const page = await context.newPage();
      await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
      await waitForViewer(page);

      const mermaidBlocks = viewerLocator(page, '.feishu-mermaid');
      await mermaidBlocks.first().scrollIntoViewIfNeeded();
      await expect(viewerLocator(page, '.feishu-mermaid:not(.feishu-mermaid--error) svg')).toBeVisible({ timeout: 15_000 });
      await expect(viewerLocator(page, '.feishu-mermaid--error')).toBeVisible({ timeout: 15_000 });
      await expect(viewerLocator(page, '[role="article"]')).toContainText('发布验收 Fixture');
    } finally {
      await context.close();
      await fixture.cleanup();
    }
  });

  test('主题切换后正文与 Mermaid 预览保持可见', async () => {
    const fixture = await createTempMarkdownFixture();
    const context = await createBrowserContext();
    try {
      const page = await context.newPage();
      await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
      await waitForViewer(page);

      const themeButton = viewerLocator(page, 'button[aria-label^="Theme:"]');
      await themeButton.click();
      await themeButton.click();
      await expect(viewerLocator(page, '.feishu-viewer')).toHaveClass(/feishu-viewer--dark/);
      await expect(viewerLocator(page, '[role="article"]')).toContainText('发布验收 Fixture');
      await expect(viewerLocator(page, '.feishu-mermaid').first()).toBeVisible();
    } finally {
      await context.close();
      await fixture.cleanup();
    }
  });

  test('打开 Mermaid 预览后滚轮事件保留在图表视口', async () => {
    const fixture = await createTempMarkdownFixture();
    const context = await createBrowserContext();
    try {
      const page = await context.newPage();
      await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
      await waitForViewer(page);
      await viewerLocator(page, '.feishu-mermaid').first().scrollIntoViewIfNeeded();
      await expect(viewerLocator(page, '.feishu-mermaid:not(.feishu-mermaid--error) svg')).toBeVisible({ timeout: 15_000 });

      const mermaidToolbar = viewerLocator(page, '.mermaid-toolbar-wrapper').first();
      await mermaidToolbar.hover();
      await mermaidToolbar.locator('button[aria-label="Preview Mermaid diagram"]').click();
      const canvas = viewerLocator(page, '.mermaid-preview-canvas');
      await expect(canvas).toBeVisible();
      const main = viewerLocator(page, 'main[role="main"]');
      const before = await main.evaluate((element) => element.scrollTop);
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox).not.toBeNull();
      await page.mouse.move((canvasBox?.x ?? 0) + 20, (canvasBox?.y ?? 0) + 20);
      await page.mouse.wheel(0, 260);
      const after = await main.evaluate((element) => element.scrollTop);
      expect(after).toBe(before);
      await expect(viewerLocator(page, '[role="dialog"]')).toBeVisible();
    } finally {
      await context.close();
      await fixture.cleanup();
    }
  });

  test('自动刷新局部替换正文并保留滚动位置', async () => {
    const initial = '# 发布验收 Fixture\n\n自动刷新版本 1\n\n| 列 1 | 列 2 | 列 3 | 列 4 | 列 5 | 列 6 | 列 7 | 列 8 | 列 9 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| A | B | C | D | E | F | G | H | I |\n';
    const fixture = await createTempMarkdownFixture(initial);
    const context = await createBrowserContext();
    try {
      await setViewerSettings(context, { localFileRefreshMode: 'auto' });
      const page = await context.newPage();
      await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
      await waitForViewer(page);

      const main = viewerLocator(page, 'main[role="main"]');
      const tableScrollport = viewerLocator(page, '.feishu-table__scrollport').first();
      await main.evaluate((element) => { element.scrollTop = 80; });
      await tableScrollport.evaluate((element) => { element.scrollLeft = 20; });
      const before = await Promise.all([
        main.evaluate((element) => element.scrollTop),
        tableScrollport.evaluate((element) => element.scrollLeft),
      ]);

      await fixture.write('# 发布验收 Fixture\n\n自动刷新版本 2\n\n| 列 1 | 列 2 | 列 3 | 列 4 | 列 5 | 列 6 | 列 7 | 列 8 | 列 9 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| A | B | C | D | E | F | G | H | I |\n');
      await expect(viewerLocator(page, '[role="article"]')).toContainText('自动刷新版本 2', { timeout: 8_000 });
      await expect(viewerLocator(page, '.feishu-content-update-notice')).toHaveCount(0);

      const after = await Promise.all([
        main.evaluate((element) => element.scrollTop),
        tableScrollport.evaluate((element) => element.scrollLeft),
      ]);
      expect(after[0]).toBe(before[0]);
      expect(after[1]).toBe(before[1]);
    } finally {
      await context.close();
      await fixture.cleanup();
    }
  });

  test('手动刷新只提示一次，刷新成功后提示消失', async () => {
    const fixture = await createTempMarkdownFixture('# 发布验收 Fixture\n\n手动刷新版本 1\n');
    const context = await createBrowserContext();
    try {
      await setViewerSettings(context, { localFileRefreshMode: 'prompt' });
      const page = await context.newPage();
      await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
      await waitForViewer(page);

      await fixture.write('# 发布验收 Fixture\n\n手动刷新版本 2\n');
      const notice = viewerLocator(page, '.feishu-content-update-notice');
      await expect(notice).toContainText('Markdown 文件已更新', { timeout: 8_000 });
      await expect(notice).toHaveCount(1);
      await notice.getByRole('button', { name: '立即刷新' }).click();
      await expect(viewerLocator(page, '[role="article"]')).toContainText('手动刷新版本 2');
      await expect(notice).toHaveCount(0);
    } finally {
      await context.close();
      await fixture.cleanup();
    }
  });

  test('表格单元格、整列选择和 TSV 复制可用', async () => {
    const fixture = await createTempMarkdownFixture();
    const context = await createBrowserContext();
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      const page = await context.newPage();
      await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
      await waitForViewer(page);

      const table = viewerLocator(page, '.feishu-table:not(.feishu-table--sticky-clone):not(.feishu-table--left-reveal-clone)').first();
      await table.locator('tbody td').first().click();
      await expect(table.locator('tbody td').first()).toHaveClass(/feishu-table__cell--selected/);

      await viewerLocator(page, '.feishu-table__selection-rail--top .feishu-table__selection-rail-segment').first().click();
      await expect(table.locator('.feishu-table__cell--selected')).not.toHaveCount(0);
      await expect(table.locator('.feishu-table__header--selected')).not.toHaveCount(0);

      // Ctrl/Cmd+A intentionally selects the full grid so the clipboard
      // assertion covers the multi-column Excel-compatible structure.
      await table.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Control+C');
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toContain('\t');
      expect(clipboardText).toContain('\n');
    } finally {
      await context.close();
      await fixture.cleanup();
    }
  });
});
