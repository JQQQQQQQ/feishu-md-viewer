# VS Code Markdown 只读预览实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 VS Code 增加一个默认打开 `.md` 的 Feishu 只读 Custom Editor，同时保持 Chrome 扩展行为不变。

**Architecture:** 将可复用的 Markdown 阅读渲染能力与入口生命周期分离。Chrome 保留现有 Vite/CRXJS 入口；新增 `vscode-extension/` 作为独立 VS Code 扩展，Provider 读取 `TextDocument`，Webview 通过受 CSP 保护的消息接收文本并渲染共享阅读组件，不提供写回。

**Tech Stack:** VS Code Extension API、TypeScript、React 18、Vite、现有 unified/rehype/remark/Mermaid 管线、Vitest。

**Spec:** `docs/superpowers/specs/2026-08-14-vscode-preview-design.md`

## Global Constraints

- `.md` 和 `.markdown` 默认使用只读 Feishu 预览；原生编辑器通过 `Reopen Editor With -> Text Editor` 保留。
- VS Code 构建输出只能写入 `vscode-extension/dist/`，不得覆盖 Chrome 的 `dist/`。
- VS Code 预览不得写回文档，不实现保存、另存为或文件修改 API。
- Webview 使用 `webview.asWebviewUri`、随机 nonce 和严格 CSP，不加载任意远程脚本。
- Chrome 入口、Manifest、现有 Markdown/Mermaid 行为必须通过原有回归测试和构建。
- 每个任务完成后运行该任务的聚焦测试，并提交独立 commit。

### Task 1: 抽取共享只读预览入口

**Files:**
- Create: `src/viewer/PreviewRoot.tsx`
- Modify: `src/viewer/App.tsx`
- Modify: `src/viewer/viewer-entry.tsx`
- Test: `tests/unit/shared-preview-entry.test.tsx`

**Interfaces:**
- Produces `PreviewRoot({ markdown, source, themeOverride? })`，供 Chrome 和 VS Code Webview 使用。
- `PreviewRoot` 不读取 URL、不调用 Chrome API、不写入文档。

- [ ] **Step 1: Write the failing test**

```tsx
it('renders the same read-only document contract without a browser URL', () => {
  render(<PreviewRoot markdown="# 标题" source="file" />);
  expect(screen.getByRole('article')).toHaveAttribute('data-mode', 'read');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/shared-preview-entry.test.tsx`

Expected: FAIL because `PreviewRoot` does not exist.

- [ ] **Step 3: Write minimal implementation**

Move the existing reading shell composition from `App` into `PreviewRoot`; keep `App` as a compatibility wrapper that passes the same props. Update `viewer-entry.tsx` to render the wrapper without changing URL fetching.

- [ ] **Step 4: Run focused and Chrome regression tests**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/shared-preview-entry.test.tsx tests/unit/preview-only-app.test.tsx tests/unit/MarkdownReadView.test.tsx`

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/viewer/PreviewRoot.tsx src/viewer/App.tsx src/viewer/viewer-entry.tsx tests/unit/shared-preview-entry.test.tsx
git commit -m "refactor: extract shared markdown preview root"
```

### Task 2: 创建 VS Code Custom Editor Provider

**Files:**
- Create: `vscode-extension/package.json`
- Create: `vscode-extension/tsconfig.json`
- Create: `vscode-extension/src/MarkdownPreviewProvider.ts`
- Create: `vscode-extension/src/extension.ts`
- Test: `vscode-extension/tests/MarkdownPreviewProvider.test.ts`

**Interfaces:**
- Produces `MarkdownPreviewProvider implements vscode.CustomReadonlyEditorProvider`.
- `openCustomDocument(uri)` returns the VS Code `TextDocument` without mutation.
- `resolveCustomEditor(document, panel)` sends `{ type: 'document', text, version }` after Webview ready.
- Provider owns listeners and disposes them with the panel/document.

- [ ] **Step 1: Write failing Provider tests**

Cover `*.md` registration metadata, initial document message, versioned update, stale message discard, and no writeback methods.

- [ ] **Step 2: Run tests to verify failure**

Run: `TMPDIR=/tmp npm test -- --run vscode-extension/tests/MarkdownPreviewProvider.test.ts`

Expected: FAIL because the extension directory and provider do not exist.

- [ ] **Step 3: Implement Provider and activation**

Register `feishu-md-viewer.markdownPreview` with `priority: "default"`; use a message queue until Webview sends `ready`; post only the newest document version; dispose all listeners on panel close.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `TMPDIR=/tmp npm test -- --run vscode-extension/tests/MarkdownPreviewProvider.test.ts && npx tsc -p vscode-extension/tsconfig.json --noEmit`

Expected: all Provider tests and typecheck pass.

- [ ] **Step 5: Commit**

```bash
git add vscode-extension/package.json vscode-extension/tsconfig.json vscode-extension/src vscode-extension/tests
git commit -m "feat: add VS Code markdown custom editor provider"
```

### Task 3: 构建 VS Code Webview 入口和安全资源

**Files:**
- Create: `vscode-extension/webview/entry.tsx`
- Create: `vscode-extension/webview/index.html`
- Create: `vscode-extension/vite.config.ts`
- Modify: `vscode-extension/src/MarkdownPreviewProvider.ts`
- Test: `vscode-extension/tests/webview-message.test.tsx`

**Interfaces:**
- Webview sends `{ type: 'ready' }` once after mount.
- Webview accepts `{ type: 'document', text, version }`, `{ type: 'theme', kind }`, and `{ type: 'error', message }`.
- Provider supplies generated `scriptUri`, `styleUri`, nonce and CSP values; no `file://` is emitted.

- [ ] **Step 1: Write failing Webview tests**

Assert ready handshake, Markdown render after document message, stale version rejection, empty state, and light/dark class changes.

- [ ] **Step 2: Run tests to verify failure**

Run: `TMPDIR=/tmp npm test -- --run vscode-extension/tests/webview-message.test.tsx`

Expected: FAIL because Webview entry does not exist.

- [ ] **Step 3: Implement Webview bootstrap and CSP**

Mount `PreviewRoot` into a local root, wire `window.message`, keep the highest received version, and use a generated nonce in `script-src`. Configure Vite to emit self-contained assets under `vscode-extension/dist/`.

- [ ] **Step 4: Run Webview tests and build**

Run: `TMPDIR=/tmp npm test -- --run vscode-extension/tests/webview-message.test.tsx && npm run build:vscode`

Expected: tests pass and only `vscode-extension/dist/` is changed.

- [ ] **Step 5: Commit**

```bash
git add vscode-extension/webview vscode-extension/vite.config.ts vscode-extension/src/MarkdownPreviewProvider.ts vscode-extension/tests/webview-message.test.tsx
git commit -m "feat: render shared preview inside VS Code webview"
```

### Task 4: 主题、错误态和安装说明

**Files:**
- Modify: `vscode-extension/src/MarkdownPreviewProvider.ts`
- Modify: `vscode-extension/package.json`
- Create: `vscode-extension/README.md`
- Test: `vscode-extension/tests/vscode-preview-states.test.ts`

**Interfaces:**
- Provider sends `theme` updates when VS Code active color theme changes.
- Webview displays empty, document-error and render-error states while keeping the panel usable.
- README documents default preview behavior and native editor fallback.

- [ ] **Step 1: Write failing state tests**

Cover empty document, theme change, provider error message, and disposal without post-dispose messages.

- [ ] **Step 2: Run tests to verify failure**

Run: `TMPDIR=/tmp npm test -- --run vscode-extension/tests/vscode-preview-states.test.ts`

Expected: FAIL for missing state handling.

- [ ] **Step 3: Implement state handling and contribution metadata**

Add theme listener, explicit status messages, `activationEvents`, Markdown filename selectors, and a user-facing command label for reopening the native editor.

- [ ] **Step 4: Run focused tests and package metadata checks**

Run: `TMPDIR=/tmp npm test -- --run vscode-extension/tests/vscode-preview-states.test.ts && node -e "const p=require('./vscode-extension/package.json'); if(!p.contributes.customEditors?.[0]?.selector?.some(x=>x.filenamePattern==='*.md')) process.exit(1)"`

Expected: all tests pass and metadata check exits 0.

- [ ] **Step 5: Commit**

```bash
git add vscode-extension/src/MarkdownPreviewProvider.ts vscode-extension/package.json vscode-extension/README.md vscode-extension/tests/vscode-preview-states.test.ts
git commit -m "feat: add VS Code preview states and usage docs"
```

### Task 5: 全量回归、构建和手工验收

**Files:**
- Modify: `package.json`
- Create: `scripts/vscode/verify-preview-build.mjs`
- Create: `docs/superpowers/reports/2026-08-14-vscode-preview-verification.md`

- [ ] **Step 1: Add build and verification scripts**

Add `build:vscode`, `test:vscode`, and a script that asserts Chrome `dist/` and VS Code `vscode-extension/dist/` are separate and that Chrome output contains no VS Code API import.

- [ ] **Step 2: Run complete automated verification**

Run: `TMPDIR=/tmp npm test && npm run typecheck && npm run build && npm run build:vscode && node scripts/vscode/verify-preview-build.mjs && git diff --check`

Expected: all commands exit 0; existing Chrome test suite remains green.

- [ ] **Step 3: Run manual VS Code acceptance**

Install the packaged VSIX in a clean VS Code profile, open a Markdown file, verify default preview, edit through native Text Editor, switch back, modify externally, and verify refresh.

- [ ] **Step 4: Record evidence**

Write exact commands, test counts, build paths, and manual results to `docs/superpowers/reports/2026-08-14-vscode-preview-verification.md`.

- [ ] **Step 5: Commit final integration**

```bash
git add package.json scripts/vscode docs/superpowers/reports/2026-08-14-vscode-preview-verification.md
git commit -m "test: verify Chrome and VS Code preview builds"
```

