# 发布质量与 E2E 验收 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Chrome 浏览器、VS Code 和发布产物的统一质量门禁，让本地 Markdown 自动刷新、表格交互、目录布局和 Mermaid 预览具备可重复的发布前验收能力。

**Architecture:** 使用 Node 发布脚本编排既有 Vitest、类型检查、Chrome/VS Code 构建和产物校验；使用 Playwright 挂载已构建的 Chrome 扩展，在临时 `file://` Markdown 文件上覆盖真实浏览器关键路径；VS Code 使用现有 Provider/Webview 自动测试加产物检查，真实 VS Code GUI 通过中文人工验收清单完成。

**Tech Stack:** React 18, TypeScript 5, Vite 5, Vitest, Playwright Test, Node.js 20/22, GitHub Actions, VS Code Custom Editor。

**Spec:** `docs/superpowers/specs/2026-08-26-release-quality-e2e-design.md`

## Global Constraints

- 默认保持只读预览，不恢复 Markdown 或 Mermaid 编辑能力。
- Chrome 和 VS Code 必须分别构建，Chrome 入口不得包含 VS Code API，VS Code Webview 不得依赖 `chrome.*`。
- 本地文件 E2E 使用临时副本，不修改仓库中的 `test-e2e.md` 或其他源文件。
- 自动刷新检测周期保持当前实现的约 3 秒，断言使用轮询条件而不是固定长时间 `sleep`。
- 所有新增测试使用中文测试描述，并放在 `tests/**/*.test.{ts,tsx}` 或 `tests/e2e/**/*.spec.ts`。
- 每个任务完成后独立运行该任务的测试，再提交该任务的文件；不得把生成的 `dist/` 临时文件作为源码提交。
- Mermaid JSDOM 的 `getBBox` 已知警告不能掩盖真正的测试失败；命令退出码必须作为门禁依据。

---

### Task 1: 发布产物检查器

**Files:**
- Create: `scripts/release/check-artifacts.mjs`
- Create: `tests/unit/release-artifacts.test.ts`
- Modify: `package.json`（增加 `check:artifacts` 脚本）

**Interfaces:**
- Produces `inspectArtifacts(options): ArtifactReport`，其中 `options.rootDir` 为仓库根目录，`options.chromeDistDir` 默认 `dist`，`options.vscodeDir` 默认 `vscode-extension`，`options.vsixPath` 可选。
- `ArtifactReport` 至少包含 `ok: boolean`、`errors: string[]`、`warnings: string[]` 和 `checks: Array<{ name: string; ok: boolean; detail: string }>`。
- 当 `ok` 为 `false` 时，CLI 以退出码 1 结束，并打印每个失败检查；所有检查通过时退出码为 0。

- [ ] **Step 1: 写产物检查器的失败测试**

在 `tests/unit/release-artifacts.test.ts` 中使用临时目录构造最小 Chrome/VS Code 产物，覆盖以下断言：

```ts
it('检查 Chrome Manifest、VS Code 入口和 HTML 引用资源', async () => {
  const report = await inspectArtifacts(createValidArtifactFixture());

  expect(report.ok).toBe(true);
  expect(report.checks.map((check) => check.name)).toEqual(expect.arrayContaining([
    'Chrome Manifest',
    'VS Code 宿主入口',
    'VS Code Webview 资源引用',
  ]));
});

it('资源缺失或跨端 API 污染时失败', async () => {
  const report = await inspectArtifacts(createFixtureWithMissingResourceAndCrossApiImport());

  expect(report.ok).toBe(false);
  expect(report.errors.join('\n')).toMatch(/资源|VS Code API|chrome/);
});

it('校验各平台内部版本，并允许 Chrome 与 VS Code 使用不同版本', async () => {
  const report = await inspectArtifacts(createFixtureWithMismatchedVersions());

  expect(report.ok).toBe(false);
  expect(report.errors.join('\n')).toContain('版本');
});
```

- [ ] **Step 2: 运行失败测试确认检查器尚不存在**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/release-artifacts.test.ts`

Expected: FAIL，提示 `scripts/release/check-artifacts.mjs` 或 `inspectArtifacts` 尚不存在。

- [ ] **Step 3: 实现最小产物检查器**

实现以下检查：

```js
export async function inspectArtifacts({ rootDir, chromeDistDir = 'dist', vscodeDir = 'vscode-extension', vsixPath } = {}) {
  // 读取并校验 JSON、入口文件、HTML 相对资源和版本号。
  // 读取 JS 入口文本，检查 Chrome 入口不含 vscode API，VS Code Webview 不含 chrome.*。
  // 传入 vsixPath 时使用 Node Buffer 扫描 ZIP 中央目录，不解压覆盖工作区。
  return { ok: errors.length === 0, errors, warnings, checks };
}
```

HTML 资源解析只允许 `./assets/...` 相对引用，并要求每个引用文件真实存在；Chrome 和 VS Code 使用独立版本号，版本号使用三段数字格式，并分别校验同一平台的源配置、构建产物和发布包版本一致。

- [ ] **Step 4: 运行产物检查测试确认通过**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/release-artifacts.test.ts`

Expected: 3 个测试通过。

- [ ] **Step 5: 增加 npm 命令并验证真实构建产物**

在 `package.json` 增加：

```json
"check:artifacts": "node scripts/release/check-artifacts.mjs"
```

Run: `npm run build && npm run build:vscode && npm run check:artifacts`

Expected: 产物检查器以退出码 0 结束，并列出 Chrome Manifest、VS Code 宿主、Webview 资源和版本检查结果。

- [ ] **Step 6: 提交任务 1**

```bash
git add scripts/release/check-artifacts.mjs tests/unit/release-artifacts.test.ts package.json
git commit -m "test: add release artifact checks"
```

### Task 2: 统一发布门禁编排

**Files:**
- Create: `scripts/release/verify-release.mjs`
- Create: `tests/unit/verify-release.test.ts`
- Modify: `package.json`（增加 `verify:release` 脚本）

**Interfaces:**
- Produces `runReleaseVerification(options): Promise<ReleaseReport>`，`options.run` 可注入命令执行器，`options.cwd` 可指定仓库目录，`options.includeE2E` 默认读取 `RUN_E2E=1`。
- `ReleaseReport` 包含 `ok`、`steps: Array<{ name: string; command: string; status: 'passed' | 'failed' | 'skipped'; durationMs: number; output: string }>`。
- CLI 按固定顺序执行：全量 Vitest、类型检查、Chrome 构建、VS Code 构建、VS Code 隔离验证、产物检查；设置 `RUN_E2E=1` 时最后执行浏览器 E2E。

- [ ] **Step 1: 写门禁编排失败测试**

```ts
it('按固定顺序执行所有发布门禁', async () => {
  const run = vi.fn().mockResolvedValue({ code: 0, output: '' });

  const report = await runReleaseVerification({ cwd: '/repo', run, includeE2E: false });

  expect(report.ok).toBe(true);
  expect(report.steps.map((step) => step.name)).toEqual([
    '单元测试',
    '类型检查',
    'Chrome 构建',
    'VS Code 构建',
    'VS Code 产物验证',
    '发布产物检查',
    '浏览器 E2E',
  ]);
});

it('任一步失败后停止后续步骤并返回失败报告', async () => {
  const run = vi.fn()
    .mockResolvedValueOnce({ code: 0, output: '' })
    .mockResolvedValueOnce({ code: 1, output: 'type error' });

  const report = await runReleaseVerification({ cwd: '/repo', run, includeE2E: false });

  expect(report.ok).toBe(false);
  expect(report.steps[1]).toMatchObject({ name: '类型检查', status: 'failed' });
  expect(run).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: 运行失败测试确认门禁接口不存在**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/verify-release.test.ts`

Expected: FAIL，提示 `runReleaseVerification` 尚不存在。

- [ ] **Step 3: 实现命令编排器**

使用 Node `child_process.spawn` 的 Promise 包装器执行命令，逐步记录开始时间、结束时间、退出码和合并输出；不要吞掉失败命令的原始 stderr。命令列表固定为：

```js
[
  ['单元测试', 'npm', ['test', '--', '--run']],
  ['类型检查', 'npm', ['run', 'typecheck']],
  ['Chrome 构建', 'npm', ['run', 'build']],
  ['VS Code 构建', 'npm', ['run', 'build:vscode']],
  ['VS Code 产物验证', 'npm', ['run', 'verify:vscode']],
  ['发布产物检查', 'npm', ['run', 'check:artifacts']],
]
```

当 `includeE2E` 为 `true` 时追加 `['浏览器 E2E', 'npm', ['run', 'test:e2e']]`。在 Windows 上使用 `npm.cmd`，其他系统使用 `npm`。

- [ ] **Step 4: 运行门禁测试确认通过**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/verify-release.test.ts`

Expected: 2 个测试通过。

- [ ] **Step 5: 增加 npm 命令并运行一次真实门禁**

在 `package.json` 增加：

```json
"verify:release": "node scripts/release/verify-release.mjs"
```

Run: `npm run verify:release`

Expected: 所有非 E2E 阶段通过；若浏览器依赖未安装，输出明确说明 E2E 未包含在默认门禁中，而不是伪造通过。

- [ ] **Step 6: 提交任务 2**

```bash
git add scripts/release/verify-release.mjs tests/unit/verify-release.test.ts package.json
git commit -m "ci: add unified release verification"
```

### Task 3: 浏览器 E2E 基础设施与综合 Fixture

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/fixtures/all-markdown-features.md`
- Create: `tests/e2e/browser/helpers.ts`
- Create: `tests/e2e/browser/preview.spec.ts`
- Modify: `package.json`（增加 `test:e2e`、`test:e2e:install` 和 Playwright 依赖）

**Interfaces:**
- Produces `createBrowserContext()`，使用构建后的 `dist` 作为 Chrome 扩展目录，并以 `--load-extension` 和 `--disable-extensions-except` 启动。
- Produces `createTempMarkdownFixture()`，返回 `{ filePath, write, restore, cleanup }`，所有测试结束必须调用 `cleanup`。
- Produces Playwright 项目 `browser-extension`，默认只运行 `tests/e2e/browser/**/*.spec.ts`。

- [ ] **Step 1: 写基础 E2E 的失败测试**

在 `preview.spec.ts` 先写最小真实浏览器场景：打开临时 `.md` 文件，等待 `#feishu-md-viewer-host`，进入 Shadow DOM 后断言正文标题和目录存在。

```ts
test('本地 Markdown 文件进入 Feishu 预览', async ({ page }) => {
  const fixture = await createTempMarkdownFixture();
  await page.goto(pathToFileURL(fixture.filePath).href);

  const host = page.locator('#feishu-md-viewer-host');
  await expect(host).toBeAttached();
  await expect(host.locator('.feishu-viewer')).toBeVisible();
  await expect(host.getByRole('heading', { name: '发布验收 Fixture' })).toBeVisible();

  await fixture.cleanup();
});
```

- [ ] **Step 2: 安装 Playwright 并运行失败测试**

增加 `@playwright/test` 开发依赖和脚本：

```json
"test:e2e": "playwright test",
"test:e2e:install": "playwright install chromium"
```

Run: `pnpm add -D @playwright/test` 后执行 `npm run build && npm run test:e2e -- --project=browser-extension`

Expected: 在尚未创建配置或 Fixture 时失败，错误指向 E2E 入口缺失或扩展未加载。

- [ ] **Step 3: 实现 Playwright 配置和临时文件工具**

配置使用 Chromium 持久化上下文，`headless` 默认由 `E2E_HEADLESS` 控制；CI 使用 `xvfb-run` 运行 headed Chromium。扩展参数固定为：

```ts
args: [
  `--disable-extensions-except=${extensionDir}`,
  `--load-extension=${extensionDir}`,
  '--allow-file-access-from-files',
]
```

Fixture 写入完整 Markdown 内容，内容包括标题、目录层级、段落、内联代码、列表、任务列表、引用、Callout、普通代码块、图片、普通表格、宽表格、有效 Mermaid 和无效 Mermaid。

- [ ] **Step 4: 构建后运行基础 E2E 确认通过**

Run: `npm run build && npm run test:e2e -- --project=browser-extension`

Expected: 本地 Markdown 文件被扩展接管，Shadow DOM 预览根节点、正文标题和目录均存在。

- [ ] **Step 5: 提交任务 3**

```bash
git add playwright.config.ts tests/e2e package.json pnpm-lock.yaml
git commit -m "test: scaffold browser preview e2e"
```

### Task 4: 浏览器预览、目录和 Mermaid E2E

**Files:**
- Modify: `tests/e2e/browser/preview.spec.ts`
- Modify: `tests/e2e/fixtures/all-markdown-features.md`

**Interfaces:**
- Consumes `createBrowserContext` 和 `createTempMarkdownFixture` from `tests/e2e/browser/helpers.ts`。
- Produces稳定的 E2E 断言，使用 Shadow DOM 内的 ARIA 角色、文本和明确 data 属性，不依赖 CSS 祖先层级。

- [ ] **Step 1: 写预览和交互失败测试**

补充以下测试：

```ts
test('目录点击定位标题且折叠不改变正文布局', async ({ page }) => {
  const content = page.locator('.feishu-viewer__content');
  const before = await content.boundingBox();
  await page.getByRole('link', { name: '目录目标标题' }).click();
  await expect(page.getByRole('heading', { name: '目录目标标题' })).toBeInViewport();
  await page.getByRole('button', { name: 'Close navigation' }).click();
  const after = await content.boundingBox();
  expect(after?.x).toBe(before?.x);
});

test('Mermaid 正常图和错误图分别显示图表与降级状态', async ({ page }) => {
  await expect(page.locator('.feishu-mermaid:not(.feishu-mermaid--error)').first()).toBeVisible();
  await expect(page.locator('.feishu-mermaid--error')).toBeVisible();
  await expect(page.getByRole('heading', { name: '发布验收 Fixture' })).toBeVisible();
});

test('浅色和深色主题下正文与 Mermaid 保持可读', async ({ page }) => {
  const viewer = page.locator('.feishu-viewer');
  await page.getByRole('button', { name: /Theme:/ }).click();
  await expect(viewer).toHaveClass(/feishu-viewer--dark/);
  await expect(page.locator('.feishu-mermaid').first()).toBeVisible();
});

test('滚轮操作 Mermaid 预览时不滚动外层文档', async ({ page }) => {
  await page.getByRole('button', { name: 'Preview Mermaid diagram' }).first().click();
  const canvas = page.locator('.mermaid-preview-canvas');
  await expect(canvas).toBeVisible();
  const before = await page.evaluate(() => window.scrollY);
  await canvas.hover();
  await page.mouse.wheel(0, 260);
  const after = await page.evaluate(() => window.scrollY);
  expect(after).toBe(before);
});
```

- [ ] **Step 2: 运行场景确认失败或缺少断言**

Run: `npm run build && npm run test:e2e -- --project=browser-extension tests/e2e/browser/preview.spec.ts`

Expected: 新增场景在实现前至少有一个失败或未找到元素的结果；记录失败截图和控制台日志。

- [ ] **Step 3: 使用稳定定位补齐场景**

为缺失的长期定位点增加 `data-testid` 或 `aria-label`，优先复用现有语义角色；禁止为了测试暴露源码编辑入口。Mermaid 错误场景只断言错误区块存在及其他标题仍可见，不依赖具体 Mermaid 内部错误文案。

- [ ] **Step 4: 运行预览与 Mermaid E2E 确认通过**

Run: `npm run build && npm run test:e2e -- --project=browser-extension tests/e2e/browser/preview.spec.ts`

Expected: 目录、布局、主题、Mermaid 正常/错误降级和弹窗滚动场景通过；失败时输出截图、HTML 和控制台日志。

- [ ] **Step 5: 提交任务 4**

```bash
git add tests/e2e/browser tests/e2e/fixtures src/viewer
git commit -m "test: cover browser preview and mermaid flows"
```

### Task 5: 浏览器自动刷新、表格选择和复制 E2E

**Files:**
- Modify: `tests/e2e/browser/preview.spec.ts`
- Modify: `tests/e2e/browser/helpers.ts`
- Modify: `tests/e2e/fixtures/all-markdown-features.md`
- Modify: `src/viewer/components/Markdown/FeishuTable.tsx`（增加表格选择和复制场景所需的稳定 data 属性）

**Interfaces:**
- Consumes临时 Fixture 的 `write(nextContent)`，通过文件版本标记验证局部替换。
- Produces E2E 场景：`自动刷新`、`手动刷新`、`表格选择复制`、`宽表滚动和目录`。
- Consumes `selectRefreshMode(page, label): Promise<void>` 和 `readViewportState(page, main, table): Promise<{ windowY: number; mainY: number; tableX: number }>` from `tests/e2e/browser/helpers.ts`。

- [ ] **Step 1: 写刷新和表格场景的失败测试**

```ts
test('自动刷新局部替换正文并保留滚动位置', async ({ page }) => {
  const fixture = await createTempMarkdownFixture();
  try {
  await selectRefreshMode(page, '自动刷新');
  const main = page.locator('main[role="main"]');
  const tableScrollport = page.locator('.feishu-table__scrollport').first();
  await main.evaluate((element) => { element.scrollTop = 180; });
  await tableScrollport.evaluate((element) => { element.scrollLeft = 120; });
  const before = await readViewportState(page, main, tableScrollport);
  await fixture.write('# 发布验收 Fixture\n\n自动刷新版本 2');
  await expect(page.getByText('自动刷新版本 2')).toBeVisible({ timeout: 7000 });
  await expect(page.getByRole('button', { name: '立即刷新' })).toHaveCount(0);
  const after = await readViewportState(page, main, tableScrollport);
  expect(after.windowY).toBe(before.windowY);
  expect(after.mainY).toBe(before.mainY);
  expect(after.tableX).toBe(before.tableX);
  } finally {
    await fixture.cleanup();
  }
});

test('手动刷新只提示一次且读取成功后提示消失', async ({ page }) => {
  const fixture = await createTempMarkdownFixture();
  try {
  await selectRefreshMode(page, '提示后手动刷新');
  await fixture.write('# 发布验收 Fixture\n\n手动刷新版本 2');
  const notice = page.getByRole('status');
  await expect(notice).toContainText('Markdown 文件已更新', { timeout: 7000 });
  await notice.getByRole('button', { name: '立即刷新' }).click();
  await expect(page.getByText('手动刷新版本 2')).toBeVisible();
  await expect(notice).toHaveCount(0);
  } finally {
    await fixture.cleanup();
  }
});

test('表格单元格、行列选择和 Excel 复制结构可用', async ({ page, context }) => {
  const fixture = await createTempMarkdownFixture();
  try {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const table = page.locator('.feishu-table').first();
  await table.locator('tbody td').first().click();
  await expect(table.locator('tbody td').first()).toHaveClass(/selected/);
  await table.locator('[data-selection-axis="column"]').first().click();
  await expect(table.locator('tbody td.selected')).not.toHaveCount(0);
  await page.keyboard.press('Control+C');
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('\t');
  expect(clipboardText).toContain('\n');
  } finally {
    await fixture.cleanup();
  }
});
```

- [ ] **Step 2: 运行刷新/表格场景确认失败**

Run: `npm run build && npm run test:e2e -- --project=browser-extension tests/e2e/browser/preview.spec.ts`

Expected: 新场景在实现前失败，保留 Playwright 的截图和 trace 作为问题证据。

- [ ] **Step 3: 实现稳定的测试同步和剪贴板权限**

使用 `expect.poll` 等待正文版本标记，不使用固定 3 秒 sleep；测试上下文申请 `clipboard-read`、`clipboard-write` 权限，并在每个测试后清理临时文件。表格复制同时读取 `text/plain` 和 `text/html`，只断言结构，不断言浏览器剪贴板实现的无关属性。

- [ ] **Step 4: 运行刷新和表格 E2E 确认通过**

Run: `npm run build && npm run test:e2e -- --project=browser-extension tests/e2e/browser/preview.spec.ts`

Expected: 自动刷新不出现手动按钮；手动模式提示只出现一次；正文和表格滚动位置保持；单元格、行列选择及 TSV/HTML 复制通过。

- [ ] **Step 5: 提交任务 5**

```bash
git add tests/e2e/browser tests/e2e/fixtures src/viewer/components/Markdown/FeishuTable.tsx
git commit -m "test: cover refresh and table workflows"
```

### Task 6: VS Code 自动检查与人工验收文档

**Files:**
- Create: `docs/release-acceptance.md`
- Modify: `vscode-extension/tests/verify-preview-build-script.test.ts`
- Modify: `vscode-extension/tests/MarkdownPreviewProvider.test.ts`
- Modify: `vscode-extension/README.md`

**Interfaces:**
- Produces中文人工验收清单，包含环境、安装、预期、实际结果、截图/日志路径字段。
- Produces自动检查覆盖 Provider 内容推送、外部文档更新、主题消息、表格宽度持久化、Webview 资源和跨端 API 隔离。

- [ ] **Step 1: 写验收文档和自动检查失败测试**

在 `docs/release-acceptance.md` 固定以下章节：

```text
环境信息
安装与默认预览
外部文件更新
主题与字号
目录与布局
表格选择/复制/列宽
Mermaid 正常图/错误图
原生编辑器回退
源文件未被修改
结果记录
```

在 VS Code 测试中增加外部更新消息和资源隔离断言；每个断言都使用现有 Provider/Webview 测试工具，不启动真实 VS Code GUI。

- [ ] **Step 2: 运行 VS Code 测试确认新增断言失败**

Run: `TMPDIR=/tmp npm test -- --run vscode-extension/tests`

Expected: 新增的外部更新或清单断言在实现前失败，失败信息明确指出缺少接口或验收章节。

- [ ] **Step 3: 实现自动检查和人工清单**

补充 Provider 的文档版本更新测试、Webview 的主题/内容消息测试，以及 README 中的发布前验收入口。人工清单必须明确“自动测试通过不能代替 Windows 原生 VS Code 手工验收”。

- [ ] **Step 4: 运行 VS Code 测试和构建验证**

Run: `TMPDIR=/tmp npm test -- --run vscode-extension/tests && npm run build:vscode && npm run verify:vscode`

Expected: VS Code 测试、构建和产物隔离验证全部通过。

- [ ] **Step 5: 提交任务 6**

```bash
git add docs/release-acceptance.md vscode-extension/tests vscode-extension/README.md
git commit -m "docs: add vscode release acceptance checklist"
```

### Task 7: GitHub Actions CI 与发布入口

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`（CI 和 E2E 相关脚本最终对齐）
- Modify: `scripts/release/verify-release.mjs`（支持 CI 环境变量和报告目录）
- Create: `.gitignore` 条目（忽略临时 Playwright 报告和构建目录，不忽略正式发布包目录）

**Interfaces:**
- Produces CI job `quality`，Node.js 20/22 矩阵执行单元测试、类型检查、两端构建、产物检查和 VS Code 测试。
- Produces可选的 `browser-e2e` job，在 Ubuntu 使用 `xvfb-run` 执行 Playwright Chromium；失败时上传截图、HTML、trace 和构建日志。
- `CI=1` 且 `RUN_E2E=1` 时门禁命令必须在 E2E 缺少浏览器依赖时失败并给出安装命令，不能静默跳过；不带 `RUN_E2E=1` 的质量 job 明确记录 E2E 为 skipped。

- [ ] **Step 1: 写 CI 配置和报告行为的失败测试**

```ts
it('CI 的浏览器 E2E job 不静默跳过缺失的浏览器依赖', async () => {
  const run = vi.fn().mockResolvedValue({ code: 1, output: 'Executable not found' });
  const report = await runReleaseVerification({ includeE2E: true, env: { CI: '1', RUN_E2E: '1' }, run });
  expect(report.ok).toBe(false);
  expect(report.steps.at(-1)).toMatchObject({ name: '浏览器 E2E', status: 'failed' });
});
```

同时检查 `.github/workflows/ci.yml` 包含 Node 20、Node 22、`npm run verify:release`、Playwright Artifact 上传和 `xvfb-run`。

- [ ] **Step 2: 运行 CI 配置测试确认失败**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/verify-release.test.ts`

Expected: 新增 CI 行为断言在实现前失败。

- [ ] **Step 3: 实现 CI 工作流和报告上传**

CI 使用 `actions/checkout`、`actions/setup-node`、`corepack enable`、锁文件安装和缓存；非浏览器质量 job 执行 `npm run verify:release`（不带 E2E），浏览器 job 构建后运行 `xvfb-run -a npm run test:e2e`。统一上传 `playwright-report/`、`test-results/` 和构建日志。

- [ ] **Step 4: 运行本地等价命令验证 CI 门禁**

Run: `CI=1 npm run verify:release`

Expected: 非 E2E 门禁通过；若本机未安装浏览器，单独执行 `CI=1 npm run test:e2e` 必须以明确安装提示失败。

- [ ] **Step 5: 提交任务 7**

```bash
git add .github/workflows/ci.yml scripts/release/verify-release.mjs package.json .gitignore
git commit -m "ci: add release quality workflow"
```

### Task 8: 发布前最终验收和报告

**Files:**
- Modify: `docs/release-acceptance.md`
- Create: `docs/release-report.md`

**Interfaces:**
- Produces `docs/release-report.md`，记录提交哈希、版本号、测试数量、构建产物、E2E 结果和 VS Code 手工验收结果。
- Final command is `npm run verify:release` plus Windows native VS Code checklist; report must distinguish automated pass, manual pass and blocked items.

- [ ] **Step 1: 执行完整发布门禁**

Run: `npm run verify:release`

Expected: 测试、类型检查、两端构建、产物检查全部通过；E2E 若未在默认门禁中执行，报告中明确标记为未执行。

- [ ] **Step 2: 在 Windows 原生 VS Code 干净 Profile 安装 VSIX**

执行 `docs/release-acceptance.md` 中的 9 项清单，记录实际结果和截图路径；任何未验证项标记为 `BLOCKED`，不标记为通过。

- [ ] **Step 3: 生成发布报告并复核范围**

报告中列出：

```text
自动化测试结果
浏览器 E2E 结果
VS Code 自动检查结果
VS Code 手工验收结果
产物路径和版本号
已知警告
未解决阻塞项
```

- [ ] **Step 4: 运行最终检查并提交报告**

Run: `git diff --check && npm run verify:release && git status --short`

Expected: 差异检查和发布门禁通过；工作区只包含明确记录在报告中的发布文件，不存在未说明的临时产物。

- [ ] **Step 5: 提交任务 8**

```bash
git add docs/release-acceptance.md docs/release-report.md scripts/release/check-artifacts.mjs
git commit -m "docs: record release acceptance results"
```

## 计划自检

- 设计文档中的统一门禁对应 Task 1、Task 2 和 Task 7。
- 浏览器本地预览、自动刷新、手动刷新、表格复制、目录、主题、Mermaid 和错误降级对应 Task 3、Task 4、Task 5。
- VS Code Provider/Webview 自动检查和真实 GUI 人工验收对应 Task 6。
- 版本、入口、资源引用、跨端 API 和 VSIX 检查对应 Task 1、Task 7、Task 8。
- 临时文件清理、失败截图、日志、CI 上传和已知 JSDOM 警告处理均有明确任务或全局约束。
- 计划中没有 `TODO`、`TBD` 或未定义的接口名称；每个任务均包含失败测试、实现、通过验证和提交步骤。
