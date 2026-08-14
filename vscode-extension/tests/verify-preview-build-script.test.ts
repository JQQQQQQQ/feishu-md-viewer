import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const verificationScript = resolve(projectRoot, 'scripts/vscode/verify-preview-build.mjs');
const temporaryRoots: string[] = [];

interface BuildFixtureOptions {
  chromeSource?: string;
  writeIndexHtml?: boolean;
  writeJavaScriptEntry?: boolean;
  writeStylesheetEntry?: boolean;
}

function createBuildFixture({
  chromeSource = "console.log('Chrome preview');\n",
  writeIndexHtml = true,
  writeJavaScriptEntry = true,
  writeStylesheetEntry = true,
}: BuildFixtureOptions = {}): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'feishu-md-viewer-preview-build-'));
  temporaryRoots.push(fixtureRoot);

  mkdirSync(join(fixtureRoot, 'dist'), { recursive: true });
  mkdirSync(join(fixtureRoot, 'vscode-extension/dist/assets'), { recursive: true });
  mkdirSync(join(fixtureRoot, 'vscode-extension/out'), { recursive: true });
  writeFileSync(join(fixtureRoot, 'dist/content.js'), chromeSource);
  if (writeIndexHtml) {
    writeFileSync(
      join(fixtureRoot, 'vscode-extension/dist/index.html'),
      '<link rel="stylesheet" href="./assets/index.css"><script type="module" src="./assets/index.js"></script>',
    );
  }
  if (writeJavaScriptEntry) {
    writeFileSync(join(fixtureRoot, 'vscode-extension/dist/assets/index.js'), 'console.log("VS Code Webview");\n');
  }
  if (writeStylesheetEntry) {
    writeFileSync(join(fixtureRoot, 'vscode-extension/dist/assets/index.css'), 'body {}\n');
  }
  writeFileSync(join(fixtureRoot, 'vscode-extension/out/extension.js'), 'exports.activate = () => undefined;\n');
  writeFileSync(
    join(fixtureRoot, 'vscode-extension/package.json'),
    JSON.stringify({ main: './out/extension.js' }),
  );
  writeFileSync(
    join(fixtureRoot, 'vscode-extension/tsconfig.host.json'),
    JSON.stringify({ compilerOptions: { outDir: './out' } }),
  );

  return fixtureRoot;
}

function runVerification(fixtureRoot: string) {
  return spawnSync(process.execPath, [verificationScript], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      VERIFY_PREVIEW_BUILD_ROOT: fixtureRoot,
    },
  });
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('VS Code 与 Chrome 构建隔离验证脚本', () => {
  it('接受相互独立且具有 package.main 宿主输出的构建产物', () => {
    const result = runVerification(createBuildFixture());

    expect(result.status, result.stderr).toBe(0);
  });

  it('发现 Chrome 构建产物导入 vscode API 时失败', () => {
    const result = runVerification(createBuildFixture({ chromeSource: "import * as vscode from 'vscode';\n" }));

    expect(result.status).toBe(1);
  });

  it('发现 VS Code Webview 缺少 index.html 时失败', () => {
    const result = runVerification(createBuildFixture({ writeIndexHtml: false }));

    expect(result.status).toBe(1);
  });

  it('发现 index.html 引用缺失的 JavaScript 入口时失败', () => {
    const result = runVerification(createBuildFixture({ writeJavaScriptEntry: false }));

    expect(result.status).toBe(1);
  });

  it('发现 index.html 引用缺失的 CSS 入口时失败', () => {
    const result = runVerification(createBuildFixture({ writeStylesheetEntry: false }));

    expect(result.status).toBe(1);
  });
});
