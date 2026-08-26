import { chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const projectRoot = resolve(process.cwd());
const extensionDir = resolve(projectRoot, 'dist');

export interface TempMarkdownFixture {
  filePath: string;
  url: string;
  write: (content: string) => Promise<void>;
  cleanup: () => Promise<void>;
}

export async function createTempMarkdownFixture(initialContent?: string): Promise<TempMarkdownFixture> {
  const directory = await mkdtemp(join(tmpdir(), 'feishu-md-viewer-e2e-'));
  const filePath = join(directory, 'fixture.md');
  const content = initialContent ?? await readFile(
    join(projectRoot, 'tests/e2e/fixtures/all-markdown-features.md'),
    'utf8',
  );
  await writeFile(filePath, content, 'utf8');

  return {
    filePath,
    url: pathToFileURL(filePath).href,
    write: (nextContent: string) => writeFile(filePath, nextContent, 'utf8'),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

export async function createBrowserContext(): Promise<BrowserContext> {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'feishu-md-viewer-browser-'));
  try {
    return await chromium.launchPersistentContext(userDataDirectory, {
      // Chromium's headless shell disables extensions. Use headed Chromium by
      // default; CI wraps this command with xvfb-run.
      headless: process.env.E2E_HEADLESS === '1',
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
        '--allow-file-access-from-files',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
  } catch (error) {
    await rm(userDataDirectory, { recursive: true, force: true });
    throw new Error(
      `无法启动带扩展的 Chromium，请先执行 npm run build 和 npm run test:e2e:install；CI 请使用 xvfb-run。${String(error)}`,
    );
  }
}

export async function waitForViewer(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(document.querySelector('#feishu-md-viewer-host')?.shadowRoot), null, {
    timeout: 15_000,
  });
  await page.locator('#feishu-md-viewer-host .feishu-viewer').waitFor({ state: 'visible' });
}

export async function getExtensionWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers()[0];
  if (existing) return existing;
  return context.waitForEvent('serviceworker', { timeout: 10_000 });
}

export async function setViewerSettings(
  context: BrowserContext,
  settings: Partial<{
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    tocSmoothScrollEnabled: boolean;
    contentAlignment: 'left' | 'center';
    localFileRefreshMode: 'prompt' | 'auto';
  }>,
): Promise<void> {
  const worker = await getExtensionWorker(context);
  await worker.evaluate(async (nextSettings) => {
    await chrome.storage.local.set({
      viewerSettings: {
        theme: 'system',
        fontSize: 15,
        tocSmoothScrollEnabled: true,
        contentAlignment: 'center',
        localFileRefreshMode: 'prompt',
        ...nextSettings,
      },
    });
  }, settings);
}

export function viewerLocator(page: Page, selector: string) {
  return page.locator(`#feishu-md-viewer-host ${selector}`);
}
