import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { inspectArtifacts, readZipEntry } from '../../scripts/release/check-artifacts.mjs';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
}

async function createArtifactFixture(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), 'feishu-release-artifacts-'));
  tempRoots.push(rootDir);

  await mkdir(join(rootDir, 'dist', 'assets'), { recursive: true });
  await mkdir(join(rootDir, 'vscode-extension', 'dist', 'assets'), { recursive: true });
  await mkdir(join(rootDir, 'vscode-extension', 'out'), { recursive: true });

  await writeJson(join(rootDir, 'package.json'), { name: 'feishu-md-viewer', version: '1.2.3' });
  await writeJson(join(rootDir, 'public', 'manifest.json'), {
    manifest_version: 3,
    version: '1.2.3',
    background: { service_worker: 'service-worker.js' },
    content_scripts: [{ js: ['assets/content.js'], matches: ['file:///*/*.md'] }],
    options_page: 'options.html',
    icons: { '16': 'icons/icon-16.png' },
  });
  await writeFile(join(rootDir, 'dist', 'manifest.json'), JSON.stringify({
    manifest_version: 3,
    version: '1.2.3',
    background: { service_worker: 'service-worker.js' },
    content_scripts: [{ js: ['assets/content.js'], matches: ['file:///*/*.md'] }],
    options_page: 'options.html',
    icons: { '16': 'icons/icon-16.png' },
  }));
  await writeFile(join(rootDir, 'dist', 'service-worker.js'), 'self.addEventListener("install", () => {});');
  await writeFile(join(rootDir, 'dist', 'assets', 'content.js'), 'document.body.dataset.viewer = "feishu";');
  await writeFile(join(rootDir, 'dist', 'options.html'), '<script src="assets/content.js"></script>');
  await mkdir(join(rootDir, 'dist', 'icons'), { recursive: true });
  await writeFile(join(rootDir, 'dist', 'icons', 'icon-16.png'), 'png');

  await writeJson(join(rootDir, 'vscode-extension', 'package.json'), {
    name: 'feishu-md-viewer-vscode',
    version: '0.1.6',
    main: './out/extension.js',
  });
  await writeFile(join(rootDir, 'vscode-extension', 'out', 'extension.js'), 'module.exports = {};');
  await writeFile(join(rootDir, 'vscode-extension', 'dist', 'index.html'), [
    '<script type="module" src="./assets/index.js"></script>',
    '<link rel="stylesheet" href="./assets/index.css">',
  ].join('\n'));
  await writeFile(join(rootDir, 'vscode-extension', 'dist', 'assets', 'index.js'), 'document.body.dataset.preview = "ok";');
  await writeFile(join(rootDir, 'vscode-extension', 'dist', 'assets', 'index.css'), 'body { margin: 0; }');

  return rootDir;
}

describe('inspectArtifacts', () => {
  it('可以读取压缩 VSIX 中的 package.json 条目', () => {
    const vsix = Buffer.from(
      'UEsDBBQAAAAIADBGG11YzICSFQAAABMAAAAWAAAAZXh0ZW5zaW9uL3BhY2thZ2UuanNvbqtWKkstKs7Mz1OyUjLQM9QzU6oFAFBLAQIUAxQAAAAIADBGG11YzICSFQAAABMAAAAWAAAAAAAAAAAAAACAAQAAAABleHRlbnNpb24vcGFja2FnZS5qc29uUEsFBgAAAAABAAEARAAAAEkAAAAAAA==',
      'base64',
    );
    expect(readZipEntry(vsix, 'extension/package.json')).toBe('{"version":"0.1.6"}');
  });

  it('检查 Chrome Manifest、VS Code 入口和 HTML 引用资源', async () => {
    const rootDir = await createArtifactFixture();

    const report = await inspectArtifacts({ rootDir });

    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.name)).toEqual(expect.arrayContaining([
      'Chrome Manifest',
      'VS Code 宿主入口',
      'VS Code Webview 资源引用',
    ]));
  });

  it('资源缺失或跨端 API 污染时失败', async () => {
    const rootDir = await createArtifactFixture();
    await writeFile(join(rootDir, 'dist', 'assets', 'content.js'), 'import vscode from "vscode";');
    await writeFile(join(rootDir, 'vscode-extension', 'dist', 'assets', 'index.js'), 'chrome.runtime.sendMessage({});');
    await rm(join(rootDir, 'vscode-extension', 'dist', 'assets', 'index.css'));

    const report = await inspectArtifacts({ rootDir });

    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toMatch(/资源|VS Code API|chrome/);
  });

  it('校验各平台内部版本，并允许 Chrome 与 VS Code 使用不同版本', async () => {
    const rootDir = await createArtifactFixture();
    const builtManifestPath = join(rootDir, 'dist', 'manifest.json');
    const builtManifest = JSON.parse(await readFile(builtManifestPath, 'utf8'));
    builtManifest.version = '1.2.4';
    await writeJson(builtManifestPath, builtManifest);

    const report = await inspectArtifacts({ rootDir });

    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toContain('版本');
  });
});
