# GitHub 发布自动化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 通过 GitHub Actions 在推送 `vX.Y.Z` 标签后自动完成质量门禁、Chrome ZIP/VSIX 打包和同一 GitHub Release 发布。

**Architecture:** 新增一个可测试的 Node 发布元数据模块，负责解析标签、校验 Chrome 版本、生成资产名称和 Release 说明；新增一个标签触发的 `.github/workflows/release.yml`，只负责安装依赖、运行现有质量门禁、构建/打包和调用 `gh release create`。现有 `ci.yml` 保持 PR/push 验证职责不变。

**Tech Stack:** Node.js 20、ESM、Vitest、pnpm、GitHub Actions、`zip`、`@vscode/vsce`、GitHub CLI。

**Spec:** `docs/superpowers/specs/2026-08-26-release-automation-design.md`

## Global Constraints

- 只监听格式为 `vX.Y.Z` 的 Git 标签；标签去掉 `v` 后必须等于根 `package.json.version`。
- Chrome 与 VS Code 版本保持独立；VS Code 版本从 `vscode-extension/package.json` 读取。
- 发布失败、门禁失败或资产校验失败时不得创建正式 Release。
- GitHub Actions 只声明 `contents: write`，不得硬编码令牌。
- 正式资产写入 CI 临时目录，不提交构建产物到仓库。
- 不覆盖已有 Release，不改变现有 Chrome/VS Code 功能和 `ci.yml` 行为。
- 每项实现先写失败测试，再写最小实现；每个任务结束运行对应验证命令并提交。

---

### Task 1: 发布元数据解析和版本校验

**Files:**
- Create: `scripts/release/release-metadata.mjs`
- Test: `tests/unit/release-metadata.test.ts`
- Modify: `package.json`（增加本地预检脚本）

**Interfaces:**
- Produces `parseReleaseTag(tag: string): { tag: string; version: string }`。
- Produces `assertChromeVersionMatchesTag(tag: string, packageVersion: string): { tag: string; version: string }`，失败时抛出包含中文原因的 `Error`。
- Produces `createReleaseAssetNames(chromeVersion: string, vscodeVersion: string): { chromeZip: string; vscodeVsix: string }`。
- Produces `createReleaseNotes(input: { tag: string; chromeVersion: string; vscodeVersion: string; chromeZip: string; vscodeVsix: string }): string`。
- CLI 支持 `node scripts/release/release-metadata.mjs --tag <tag> --output <jsonPath> --notes <mdPath>`，读取根 `package.json` 和 `vscode-extension/package.json`，校验并写出 JSON/Markdown。

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  assertChromeVersionMatchesTag,
  createReleaseAssetNames,
  createReleaseNotes,
  parseReleaseTag,
} from '../../scripts/release/release-metadata.mjs';

describe('release metadata', () => {
  it('解析 vX.Y.Z 标签', () => {
    expect(parseReleaseTag('v0.1.1')).toEqual({ tag: 'v0.1.1', version: '0.1.1' });
  });

  it.each(['0.1.1', 'v0.1', 'v0.1.1-beta.1', 'v0.1.1/evil'])('拒绝非法标签 %s', (tag) => {
    expect(() => parseReleaseTag(tag)).toThrow(/标签/);
  });

  it('要求标签版本与 Chrome 项目版本一致', () => {
    expect(assertChromeVersionMatchesTag('v0.1.1', '0.1.1')).toEqual({ tag: 'v0.1.1', version: '0.1.1' });
    expect(() => assertChromeVersionMatchesTag('v0.1.1', '0.1.0')).toThrow(/Chrome.*版本/);
  });

  it('生成无路径注入的两端资产名称', () => {
    expect(createReleaseAssetNames('0.1.1', '0.1.7')).toEqual({
      chromeZip: 'feishu-md-viewer-chrome-0.1.1.zip',
      vscodeVsix: 'feishu-md-viewer-vscode-0.1.7.vsix',
    });
  });

  it('生成包含两个版本和下载文件名的中文 Release 说明', () => {
    const notes = createReleaseNotes({
      tag: 'v0.1.1',
      chromeVersion: '0.1.1',
      vscodeVersion: '0.1.7',
      chromeZip: 'feishu-md-viewer-chrome-0.1.1.zip',
      vscodeVsix: 'feishu-md-viewer-vscode-0.1.7.vsix',
    });
    expect(notes).toContain('Chrome 版本：`0.1.1`');
    expect(notes).toContain('VS Code 版本：`0.1.7`');
    expect(notes).toContain('feishu-md-viewer-chrome-0.1.1.zip');
    expect(notes).toContain('Windows 原生 VS Code');
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `TMPDIR=/tmp npx vitest run tests/unit/release-metadata.test.ts`

Expected: FAIL，因为 `scripts/release/release-metadata.mjs` 尚不存在。

- [ ] **Step 3: Implement the minimal metadata module**

在 `release-metadata.mjs` 中使用严格正则 `/^v(\\d+)\\.(\\d+)\\.(\\d+)$/`，拒绝额外后缀、路径分隔符和空值；所有版本输入再次使用 `/^\\d+\\.\\d+\\.\\d+$/` 校验。资产名称只由固定前缀和已校验版本组成。CLI 使用 `readFile`/`writeFile` 读取两个 package.json，将结果写成：

```json
{
  "tag": "v0.1.1",
  "chromeVersion": "0.1.1",
  "vscodeVersion": "0.1.7",
  "chromeZip": "feishu-md-viewer-chrome-0.1.1.zip",
  "vscodeVsix": "feishu-md-viewer-vscode-0.1.7.vsix"
}
```

CLI 缺少参数、文件读取失败或版本不一致时以非零退出码结束，并把错误写到 stderr。

- [ ] **Step 4: Add a local preflight script**

在 `package.json` 增加：

```json
"release:metadata": "node scripts/release/release-metadata.mjs"
```

CLI 的标签参数规则固定为：优先使用显式 `--tag`，否则读取 `GITHUB_REF_NAME`，最后读取 `RELEASE_TAG`；两者都没有时以非零退出并提示必须提供标签。这样本地预检使用 `RELEASE_TAG=v0.1.0 npm run release:metadata`，GitHub Actions 使用 `--tag "$GITHUB_REF_NAME"`，不会依赖平台特定的 shell 默认值，也不会绕过版本校验。

- [ ] **Step 5: Run focused tests and type-adjacent checks**

Run: `TMPDIR=/tmp npx vitest run tests/unit/release-metadata.test.ts`

Expected: PASS，所有标签、版本、命名和 Release 说明测试通过。

- [ ] **Step 6: Commit**

```bash
git add scripts/release/release-metadata.mjs tests/unit/release-metadata.test.ts package.json
git commit -m "feat: add release metadata validation"
```

### Task 2: 正式资产打包辅助脚本

**Files:**
- Create: `scripts/release/package-release.mjs`
- Test: `tests/unit/package-release.test.ts`
- Modify: `package.json`（增加 `package:release` 脚本）

**Interfaces:**
- Produces `buildReleaseAssets({ rootDir, outputDir, tag, runCommand }): Promise<{ metadata, chromeZipPath, vscodeVsixPath }>`。
- 读取 Task 1 的元数据函数；不负责创建 GitHub Release。
- Chrome ZIP 必须直接包含 `manifest.json`，VSIX 必须写到指定输出路径。

- [ ] **Step 1: Write the failing tests**

测试使用临时目录和注入的 `runCommand`，不真正调用 `zip` 或 `vsce`：

```ts
it('按两端版本生成固定资产路径并调用构建命令', async () => {
  const runCommand = vi.fn().mockResolvedValue({ code: 0, output: '' });
  const result = await buildReleaseAssets({
    rootDir: fixtureRoot,
    outputDir: join(fixtureRoot, 'release-assets'),
    tag: 'v1.2.3',
    runCommand,
  });
  expect(result.metadata.chromeZip).toBe('feishu-md-viewer-chrome-1.2.3.zip');
  expect(result.metadata.vscodeVsix).toBe('feishu-md-viewer-vscode-0.1.7.vsix');
  expect(runCommand).toHaveBeenCalledWith('zip', expect.arrayContaining(['-r']));
  expect(runCommand).toHaveBeenCalledWith(expect.stringMatching(/pnpm(?:\\.cmd)?$/), expect.arrayContaining(['dlx', '@vscode/vsce', 'package']));
});

it('构建命令失败时抛错且不返回可发布资产', async () => {
  const runCommand = vi.fn().mockResolvedValue({ code: 1, output: 'build failed' });
  await expect(buildReleaseAssets({ rootDir: fixtureRoot, outputDir: join(fixtureRoot, 'release-assets'), tag: 'v1.2.3', runCommand }))
    .rejects.toThrow(/构建|打包/);
});
```

- [ ] **Step 2: Run focused test to verify it fails**

Run: `TMPDIR=/tmp npx vitest run tests/unit/package-release.test.ts`

Expected: FAIL，因为辅助模块尚不存在。

- [ ] **Step 3: Implement the packaging helper**

脚本执行以下固定流程：读取并校验元数据；创建仅由调用方传入的输出目录，并只删除该目录中本次预期的同名 ZIP/VSIX 文件，不递归删除任意目录；调用 `npm run build` 生成 `dist/`；调用 `zip -r <zipPath> .`，工作目录固定为 `dist/`；调用 `npm run build:vscode`；调用 `pnpm dlx @vscode/vsce package --no-dependencies --out <vsixPath>`，工作目录固定为 `vscode-extension/`。命令退出码非零立即抛出带命令和输出的错误。CLI 参数为 `--tag` 和 `--output`，输出 JSON 元数据到 stdout，便于工作流读取。

- [ ] **Step 4: Add package script and run tests**

在 `package.json` 增加：

```json
"package:release": "node scripts/release/package-release.mjs"
```

Run: `TMPDIR=/tmp npx vitest run tests/unit/package-release.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add scripts/release/package-release.mjs tests/unit/package-release.test.ts package.json
git commit -m "feat: automate release asset packaging"
```

### Task 3: GitHub Actions 标签发布工作流

**Files:**
- Create: `.github/workflows/release.yml`
- Test: `tests/unit/release-workflow.test.ts`

**Interfaces:**
- Workflow trigger: `push.tags: ['v*.*.*']`。
- Workflow job consumes `npm run verify:release`、`npm run package:release` 和 `gh release create`。
- Workflow只在最终资产校验通过后创建 Release。

- [ ] **Step 1: Write the failing static workflow tests**

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('release workflow', () => {
  it('只由版本标签触发并声明最小写权限', async () => {
    const yaml = await readFile('.github/workflows/release.yml', 'utf8');
    expect(yaml).toContain("tags: ['v*.*.*']");
    expect(yaml).toMatch(/permissions:\s*\n\s+contents:\s+write/);
    expect(yaml).not.toMatch(/token:\s*['\"][^$]/i);
  });

  it('显式执行 E2E、打包和最终检查后再创建 Release', async () => {
    const yaml = await readFile('.github/workflows/release.yml', 'utf8');
    expect(yaml).toContain('RUN_E2E=1');
    expect(yaml).toContain('xvfb-run');
    expect(yaml).toContain('npm run package:release');
    expect(yaml).toContain('npm run check:artifacts');
    expect(yaml.indexOf('npm run check:artifacts')).toBeLessThan(yaml.indexOf('gh release create'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TMPDIR=/tmp npx vitest run tests/unit/release-workflow.test.ts`

Expected: FAIL，因为 `.github/workflows/release.yml` 尚不存在。

- [ ] **Step 3: Implement the release workflow**

工作流必须包含：

```yaml
name: Release
on:
  push:
    tags: ['v*.*.*']
permissions:
  contents: write
concurrency:
  group: release-${{ github.ref_name }}
  cancel-in-progress: true
```

job 使用 Node 20 和 `pnpm/action-setup@v4`，执行 `pnpm install --frozen-lockfile`；先运行 `node scripts/release/release-metadata.mjs` 进行版本预检，再运行 `xvfb-run -a env TMPDIR=/tmp RUN_E2E=1 npm run verify:release`。随后运行 `npm run package:release -- --tag "$GITHUB_REF_NAME" --output "$RUNNER_TEMP/feishu-release"`，从输出 JSON 读取版本/文件名；以 `VSIX_PATH` 指向生成的 VSIX 再运行 `npm run check:artifacts`。使用 `gh release create "$GITHUB_REF_NAME" --verify-tag --title ... --notes-file ... <zip> <vsix>` 创建 Release，并设置 `GH_TOKEN: ${{ github.token }}`。不得使用 `--clobber` 或删除既有 Release。

测试和 Playwright 报告均使用 `if: always()` 上传到临时 Artifact；Release 创建步骤必须依赖前置步骤成功，不能使用 `if: always()`。

- [ ] **Step 4: Run static workflow tests**

Run: `TMPDIR=/tmp npx vitest run tests/unit/release-workflow.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release.yml tests/unit/release-workflow.test.ts
git commit -m "ci: automate tagged GitHub releases"
```

### Task 4: 发布文档和本地演练入口

**Files:**
- Modify: `README.md`
- Create: `docs/release-automation.md`
- Test: `tests/unit/release-docs.test.ts`

**Interfaces:**
- README 提供版本更新、打标签、推送和 GitHub Actions 查看步骤。
- `docs/release-automation.md` 记录失败处理、重复标签规则、资产名称和人工 VS Code 验收边界。

- [ ] **Step 1: Write the failing documentation tests**

```ts
it('文档包含自动发布的最短操作路径和失败边界', async () => {
  const readme = await readFile('README.md', 'utf8');
  const guide = await readFile('docs/release-automation.md', 'utf8');
  expect(readme).toContain('git tag vX.Y.Z');
  expect(readme).toContain('GitHub Actions');
  expect(guide).toContain('标签版本必须与根 package.json 一致');
  expect(guide).toContain('不会覆盖已有 Release');
  expect(guide).toContain('Windows 原生 VS Code');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TMPDIR=/tmp npx vitest run tests/unit/release-docs.test.ts`

Expected: FAIL，因为自动发布章节和文档尚未补充。

- [ ] **Step 3: Update documentation**

README 增加“自动发布”小节，明确说明：先修改版本并提交，再执行 `git tag vX.Y.Z` 和 `git push origin vX.Y.Z`；不要手动上传构建产物；检查 Actions 结果和 Release 资产。独立文档补充标签校验、失败不发布、重复标签需新建补丁版本、Chrome/VS Code 版本独立，以及真实 Windows VS Code GUI 验收仍需人工完成。

- [ ] **Step 4: Run docs test and Prettier check**

Run: `TMPDIR=/tmp npx vitest run tests/unit/release-docs.test.ts && npx prettier --check README.md docs/release-automation.md`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add README.md docs/release-automation.md tests/unit/release-docs.test.ts
git commit -m "docs: document automated release flow"
```

### Task 5: 全量验证和发布演练

**Files:**
- Modify: `docs/release-report.md`（仅更新自动发布验证记录，不覆盖历史人工验收结论）

- [ ] **Step 1: Run focused release tests**

Run: `TMPDIR=/tmp npx vitest run tests/unit/release-metadata.test.ts tests/unit/package-release.test.ts tests/unit/release-workflow.test.ts tests/unit/release-docs.test.ts`

Expected: PASS。

- [ ] **Step 2: Run existing release gate**

Run: `TMPDIR=/tmp npm run verify:release`

Expected: PASS；本地未设置 `RUN_E2E=1` 时只允许显示 E2E skipped，不能把该结果描述为完整浏览器门禁通过。

- [ ] **Step 3: Run build and packaging smoke checks without a GitHub Release**

Run:

```bash
TMPDIR=/tmp npm run build
TMPDIR=/tmp npm run build:vscode
TMPDIR=/tmp npm run package:release -- --tag v0.1.0 --output /tmp/feishu-release-smoke
VSIX_PATH=/tmp/feishu-release-smoke/feishu-md-viewer-vscode-0.1.6.vsix npm run check:artifacts
```

Expected: Chrome ZIP、VSIX 均生成，VSIX 内容检查通过；不执行 `gh release create`，不改变现有 `v0.1.0` Release。

- [ ] **Step 4: Run full unit suite and inspect diff**

Run: `TMPDIR=/tmp npm test -- --run && git diff --check && git status --short`

Expected: 所有单测通过；差异无空白错误；工作区只包含本任务明确文件或已知构建忽略项。

- [ ] **Step 5: Commit verification record**

在 `docs/release-report.md` 追加自动发布工作流、资产打包和本地 smoke check 的实际命令/结果，并明确 Linux 本地不能替代 GitHub Actions 的 `xvfb` E2E 和 Windows 原生 VS Code GUI 验收。

```bash
git add docs/release-report.md
git commit -m "docs: record release automation verification"
```

## 执行完成标准

- `v0.1.1` 标签推送后，Actions 自动验证、打包并创建同名 Release。
- Release 包含 `feishu-md-viewer-chrome-0.1.1.zip` 和当前 VS Code 版本对应的 VSIX。
- 版本不匹配、门禁失败、资产缺失或重复 Release 时流程安全失败。
- README 和独立发布文档给出可复用的发布步骤。
