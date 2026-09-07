import { execFile } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import {
  createBrowserContext,
  createTempMarkdownFixture,
  setViewerSettings,
  viewerLocator,
  waitForViewer,
} from './helpers';

const execFileAsync = promisify(execFile);
const sizes = [1, 3, 5] as const;
const fixtureDirectory = join(tmpdir(), `feishu-md-viewer-large-${process.pid}`);

test.describe('大文档增量解析性能', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeAll(async () => {
    await mkdir(fixtureDirectory, { recursive: true });
    for (const size of sizes) {
      await execFileAsync('node', [
        'scripts/perf/generate-markdown-fixtures.mjs',
        '--size',
        String(size),
        '--output-dir',
        fixtureDirectory,
      ]);
    }
  });

  test.afterAll(async () => {
    await rm(fixtureDirectory, { recursive: true, force: true });
  });

  for (const size of sizes) {
    test(`${size} MB 文档首次可见并支持局部刷新`, async () => {
      const source = await readFile(join(fixtureDirectory, `large-${size}mb.md`), 'utf8');
      const fixture = await createTempMarkdownFixture(source);
      const context = await createBrowserContext();
      try {
        await setViewerSettings(context, { localFileRefreshMode: 'auto' });
        const page = await context.newPage();
        await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
        await waitForViewer(page);

        const article = viewerLocator(page, '[role="article"]');
        await expect(article).toContainText('大文档性能测试 Fixture');
        const firstBlock = viewerLocator(page, '[data-feishu-block-key]').first();
        await expect(firstBlock).toBeVisible();
        const firstBlockHandle = await firstBlock.elementHandle();
        const beforeScroll = await viewerLocator(page, 'main[role="main"]').evaluate((element) => {
          element.scrollTop = Math.min(500, element.scrollHeight);
          return element.scrollTop;
        });

        const updated = source.replace('PERF_MARKER_0000', `PERF_MARKER_0000_UPDATED_${size}`);
        await fixture.write(updated);
        await expect(article).toContainText(`PERF_MARKER_0000_UPDATED_${size}`, {
          timeout: 60_000,
        });
        expect(await firstBlockHandle?.evaluate((element) => element.isConnected)).toBe(true);

        const afterScroll = await viewerLocator(page, 'main[role="main"]').evaluate(
          (element) => element.scrollTop,
        );
        expect(afterScroll).toBe(beforeScroll);

        const timings = await page.evaluate(() =>
          performance
            .getEntriesByType('measure')
            .filter((entry) =>
              [
                'markdown-index',
                'markdown-parse',
                'markdown-react-commit',
                'markdown-refresh-diff',
                'mermaid-first-render',
              ].includes(entry.name),
            )
            .map((entry) => ({ name: entry.name, duration: Math.round(entry.duration) })),
        );
        console.log(`[large-doc ${size}MB]`, timings);
        expect(Array.isArray(timings)).toBe(true);
      } finally {
        await context.close();
        await fixture.cleanup();
      }
    });
  }
});
