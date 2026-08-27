# GitHub README 兼容性与来源资源解析实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Chrome 和 VS Code 预览建立可验证的 GitHub README 兼容性基线，并统一本地、GitHub、GitLab Markdown 中图片、视频、相对链接和内部锚点的解析行为。

**Architecture:** 保留现有 `rehype-raw → rehype-sanitize → rehypeReact` 管线，在 sanitizer 后增加纯函数资源解析插件；通过 `MarkdownSourceContext` 将文档 URL、内容 URL 和资源/链接基准从各入口传入共享预览。HTML 只扩展必要的安全标签和属性，链接组件负责当前文档锚点定位，资源解析器负责图片、`srcset`、视频和相对 Markdown 链接。

**Tech Stack:** React 18、TypeScript、unified、remark-gfm、rehype-raw、rehype-sanitize、rehype-react、Vitest、Playwright、VS Code Webview CSP。

**Spec:** `docs/superpowers/specs/2026-08-27-github-markdown-compatibility-design.md`

## Global Constraints

- 保留现有 `rehype-raw` 和 `rehype-sanitize` 安全边界，不允许脚本、事件属性、`iframe`、`object` 或 `embed`。
- `parseMarkdown` 在未提供来源上下文时保持现有行为，已有纯 Markdown 调用方不需要改写。
- 图片、`srcset`、视频和 poster 只接受安全的 HTTP(S)、本地文件或 VS Code Webview 资源基准；链接额外允许 `mailto:`。
- `#fragment` 必须在当前预览内滚动定位；外部链接继续新标签页打开并保留 `noopener noreferrer`。
- 不修改表格选择、列宽、目录、主题、Mermaid 和本地自动刷新行为。
- 所有新增或修改的 Markdown 文档使用简体中文。
- 每个任务按“失败测试 → 最小实现 → 测试通过 → 独立提交”执行。

---

### Task 1: 建立 README 兼容性测试文档和矩阵

**Files:**
- Create: `test-markdown-compatibility.md`
- Create: `docs/markdown-compatibility.md`
- Modify: `tests/unit/release-docs.test.ts`
- Test: `tests/unit/markdown-compatibility-doc.test.ts`

**Interfaces:**
- Produces the user-facing fixture and matrix used by later unit/E2E tasks.
- The matrix status values are exactly `PASS`, `DEGRADED`, `UNSUPPORTED`, `BLOCKED`.

- [ ] **Step 1: Write the failing documentation test**

Create `tests/unit/markdown-compatibility-doc.test.ts` with assertions that both documents exist and include every P0/P1 case:

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('GitHub Markdown compatibility documents', () => {
  it('fixture covers the README structures in the design', async () => {
    const fixture = await readFile('test-markdown-compatibility.md', 'utf8');
    for (const token of ['<details>', '<picture>', '<kbd>', '<video>', 'contrib.rocks', '<table>', '<div', 'loading="lazy"', '[跳到表格](#html-table)', 'raw.githubusercontent.com']) {
      expect(fixture).toContain(token);
    }
  });

  it('matrix records a decision for each P0/P1 item', async () => {
    const matrix = await readFile('docs/markdown-compatibility.md', 'utf8');
    for (const token of ['details / summary', 'picture / source', 'kbd', 'video', 'HTML table', 'relative image', 'GitHub blob', 'GitHub raw', 'GitLab', 'internal anchor', 'PASS', 'DEGRADED', 'UNSUPPORTED']) {
      expect(matrix).toContain(token);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `TMPDIR=/tmp npx vitest run tests/unit/markdown-compatibility-doc.test.ts`

Expected: FAIL with `ENOENT` for `test-markdown-compatibility.md`.

- [ ] **Step 3: Write the compatibility fixture**

Add a Chinese Markdown document containing:

- `#`/`##`/`###` headings and `[跳到表格](#html-table)`.
- GFM task list, blockquote, inline code, JavaScript/TypeScript code block and Mermaid normal/error blocks.
- GFM table and an equivalent raw HTML table with `<thead>` / `<tbody>`.
- Relative image `./assets/demo.png`, raw GitHub image, external badge and contributor image.
- `<details open>` with `<summary>`, `<picture>` with light/dark `<source>`, `<kbd>Ctrl</kbd> + <kbd>K</kbd>`, and `<video controls preload="metadata">`.
- A centered `<div align="center">` and a layout-only `<div class="demo-row">`.
- `loading="lazy"`, `decoding="async"`, absolute external link, relative Markdown link and a download link.
- A long repeated section to exercise scrolling and lazy loading.

- [ ] **Step 4: Write the matrix**

Add one row per fixture structure with columns `场景`, `Chrome`, `VS Code`, `安全处理`, `降级行为`, `自动化测试`. Initially mark behavior that is not implemented as `DEGRADED` or `BLOCKED`; do not mark untested behavior as `PASS`.

- [ ] **Step 5: Run the documentation tests**

Run: `TMPDIR=/tmp npx vitest run tests/unit/markdown-compatibility-doc.test.ts tests/unit/release-docs.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add test-markdown-compatibility.md docs/markdown-compatibility.md tests/unit/markdown-compatibility-doc.test.ts tests/unit/release-docs.test.ts
git commit -m "test: add GitHub Markdown compatibility fixture"
```

### Task 2: 实现来源上下文和纯函数资源解析器

**Files:**
- Create: `src/lib/markdown-resource-resolver.ts`
- Create: `tests/unit/markdown-resource-resolver.test.ts`

**Interfaces:**

```ts
export type MarkdownRuntime = 'browser' | 'vscode-webview';
export type MarkdownResourceKind = 'asset' | 'link';

export interface MarkdownSourceContext {
  source: 'file' | 'github' | 'gitlab';
  runtime?: MarkdownRuntime;
  documentUrl: string;
  contentUrl?: string;
  assetBaseUrl: string;
  linkBaseUrl: string;
}

export function createMarkdownSourceContext(
  source: MarkdownSourceContext['source'],
  documentUrl: string,
  contentUrl?: string,
  runtime?: MarkdownRuntime,
): MarkdownSourceContext;

export function resolveMarkdownUrl(
  value: string,
  context: MarkdownSourceContext | undefined,
  kind: MarkdownResourceKind,
): string | null;

export function resolveMarkdownSrcSet(
  value: string,
  context: MarkdownSourceContext | undefined,
): string | null;
```

- [ ] **Step 1: Write failing resolver tests**

Cover these exact expectations:

```ts
expect(resolveMarkdownUrl('./assets/demo.png', fileContext, 'asset')).toBe('file:///docs/assets/demo.png');
expect(resolveMarkdownUrl('./guide/setup.md', githubBlobContext, 'link')).toBe('https://github.com/acme/docs/blob/main/guide/setup.md');
expect(resolveMarkdownUrl('./assets/demo.png', githubBlobContext, 'asset')).toBe('https://raw.githubusercontent.com/acme/docs/main/assets/demo.png');
expect(resolveMarkdownUrl('../img/a.png', githubRawContext, 'asset')).toBe('https://raw.githubusercontent.com/acme/docs/main/img/a.png');
expect(resolveMarkdownUrl('./img/a.png', gitlabBlobContext, 'asset')).toBe('https://gitlab.com/acme/docs/-/raw/main/img/a.png');
expect(resolveMarkdownUrl('#html-table', fileContext, 'link')).toBe('#html-table');
expect(resolveMarkdownUrl('https://example.com/a.png', fileContext, 'asset')).toBe('https://example.com/a.png');
expect(resolveMarkdownUrl('javascript:alert(1)', fileContext, 'link')).toBeNull();
expect(resolveMarkdownSrcSet('./light.png 1x, ../wide.png 2x', githubBlobContext)).toBe('https://raw.githubusercontent.com/acme/docs/main/light.png 1x, https://raw.githubusercontent.com/acme/docs/wide.png 2x');
```

Also assert query strings and fragments survive, malformed candidates do not throw, and dangerous `data:` image URLs are rejected.

- [ ] **Step 2: Run resolver tests to verify they fail**

Run: `TMPDIR=/tmp npx vitest run tests/unit/markdown-resource-resolver.test.ts`

Expected: FAIL because the resolver module and functions do not exist.

- [ ] **Step 3: Implement URL context derivation**

Use URL parsing instead of regular-expression string concatenation:

- `file://`: both bases are the directory of `documentUrl`.
- GitHub `/owner/repo/blob/<ref>/<path>`: `linkBaseUrl` is the blob directory; `assetBaseUrl` is the matching raw directory.
- GitHub `raw.githubusercontent.com/owner/repo/<ref>/<path>`: both bases are the raw directory.
- GitLab `/owner/repo/-/blob/<ref>/<path>`: `linkBaseUrl` is the blob directory; `assetBaseUrl` is the matching `/-/raw/` directory.
- Unknown or invalid URLs use the supplied URL as a base only when it has a safe protocol; otherwise return `null`.

For an asset, resolve against `assetBaseUrl`; for a link, resolve against `linkBaseUrl`. Preserve `#fragment` without calling `new URL` against a remote base.

- [ ] **Step 4: Implement protocol validation and srcset parsing**

Allow `http:`, `https:` and `file:` for browser assets; allow `vscode-webview-resource:` when `runtime === 'vscode-webview'`. Allow `mailto:` only for links. Reject `javascript:`, `vbscript:`, `data:` and unknown schemes. Parse `srcset` by splitting candidates at commas, resolving the URL token, and preserving descriptors.

- [ ] **Step 5: Run resolver tests to verify they pass**

Run: `TMPDIR=/tmp npx vitest run tests/unit/markdown-resource-resolver.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/markdown-resource-resolver.ts tests/unit/markdown-resource-resolver.test.ts
git commit -m "feat: add source-aware Markdown resource resolver"
```

### Task 3: 扩展 sanitizer 和 Markdown AST 规范化

**Files:**
- Modify: `src/lib/markdown-pipeline.ts`
- Modify: `tests/unit/markdown-pipeline.test.ts`
- Modify: `src/viewer/components/Markdown/FeishuComponents.tsx`
- Create: `tests/unit/markdown-html-compatibility.test.tsx`

**Interfaces:**
- `parseMarkdown(content: string, context?: MarkdownSourceContext): ReactElement`.
- The pipeline adds a rehype visitor that rewrites `img.src`, `img.srcSet`, `source.src`, `source.srcSet`, `video.src`, `video.poster`, and `a.href` using Task 2 functions after `rehype-sanitize`.

- [ ] **Step 1: Write failing HTML compatibility tests**

Render `parseMarkdown` with a context and assert:

```ts
expect(container.querySelector('details summary')?.textContent).toBe('展开说明');
expect(container.querySelector('picture source')?.getAttribute('srcset')).toContain('raw.githubusercontent.com');
expect(container.querySelector('kbd')?.textContent).toBe('Ctrl');
expect(container.querySelector('video[controls]')?.getAttribute('autoplay')).toBeNull();
expect(container.querySelector('img')?.getAttribute('loading')).toBe('lazy');
expect(container.querySelector('table thead')).not.toBeNull();
expect(container.querySelector('[onclick]')).toBeNull();
expect(container.querySelector('script')).toBeNull();
```

Assert relative `src`, `srcset`, `poster` and `href` are rewritten according to the context, while `javascript:` is removed.

- [ ] **Step 2: Run tests to verify they fail**

Run: `TMPDIR=/tmp npx vitest run tests/unit/markdown-html-compatibility.test.tsx tests/unit/markdown-pipeline.test.ts`

Expected: FAIL on the missing context argument, missing safe tags/attributes, or unresolved relative URLs.

- [ ] **Step 3: Extend the schema minimally**

Append `details`, `summary`, `picture`, `source`, `kbd`, and `video` to `defaultSchema.tagNames`. Add only `open`, `srcSet`, `sizes`, `media`, `type`, `controls`, `poster`, `preload`, `playsInline`, `loading`, `decoding`, `width`, `height`, `align`, `id`, and safe class attributes to the relevant tag attribute lists. Keep all `on*`, `style`, `srcdoc`, `autoplay`, and executable embed tags disallowed.

- [ ] **Step 4: Add the resource visitor and component mappings**

Run the visitor after `rehype-sanitize` and before `rehypeReact`. Map `details`, `summary`, `picture`, `source`, `kbd`, and `video` to native elements with Feishu class names. Keep HTML tables mapped to `FeishuTable`; do not introduce a second table implementation.

- [ ] **Step 5: Run the focused tests to verify they pass**

Run: `TMPDIR=/tmp npx vitest run tests/unit/markdown-html-compatibility.test.tsx tests/unit/markdown-pipeline.test.ts tests/unit/markdown-resource-resolver.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/markdown-pipeline.ts src/viewer/components/Markdown/FeishuComponents.tsx tests/unit/markdown-pipeline.test.ts tests/unit/markdown-html-compatibility.test.tsx
git commit -m "feat: support safe GitHub README HTML structures"
```

### Task 4: 统一 Chrome、独立 Viewer 和 VS Code 的来源上下文

**Files:**
- Modify: `src/viewer/App.tsx`
- Modify: `src/viewer/PreviewRoot.tsx`
- Modify: `src/viewer/components/Markdown/MarkdownReadView.tsx`
- Modify: `src/content/index.tsx`
- Modify: `src/viewer/viewer-entry.tsx`
- Modify: `vscode-extension/src/MarkdownPreviewProvider.ts`
- Modify: `vscode-extension/webview/entry.tsx`
- Modify: `vscode-extension/tests/MarkdownPreviewProvider.test.ts`
- Modify: `vscode-extension/tests/webview-message.test.tsx`

**Interfaces:**

```ts
interface AppProps {
  markdown: string;
  source: PageSource;
  sourceContext?: MarkdownSourceContext;
  // existing props remain unchanged
}
```

The `document` Webview message gains `sourceContext?: MarkdownSourceContext`. Existing messages without it remain valid and fall back to `file` behavior.

- [ ] **Step 1: Write failing propagation tests**

Assert the Chrome content entry passes `window.location.href` as document context, the standalone viewer passes its `url` query parameter, and the VS Code provider sends a file context with a Webview asset base. Assert the Webview accepts the optional field without rejecting older messages.

- [ ] **Step 2: Run propagation tests to verify they fail**

Run: `TMPDIR=/tmp npx vitest run vscode-extension/tests/MarkdownPreviewProvider.test.ts vscode-extension/tests/webview-message.test.tsx`

Expected: FAIL because messages and component props do not carry a source context.

- [ ] **Step 3: Pass browser contexts**

In `src/content/index.tsx`, create a context from the active adapter and `window.location.href`. In `viewer-entry.tsx`, create it from `targetUrl`. Pass it through `App → PreviewRoot → MarkdownReadView`.

- [ ] **Step 4: Pass VS Code Webview context**

In `MarkdownPreviewProvider`, derive a `vscode-webview-resource:` directory URI using `webview.asWebviewUri` for the Markdown document directory, include that directory in `localResourceRoots`, and attach the context to every latest document message. Preserve the existing document version and table identity fields.

- [ ] **Step 5: Run propagation tests to verify they pass**

Run: `TMPDIR=/tmp npx vitest run vscode-extension/tests/MarkdownPreviewProvider.test.ts vscode-extension/tests/webview-message.test.tsx tests/unit/preview-only-app.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/viewer/App.tsx src/viewer/PreviewRoot.tsx src/viewer/components/Markdown/MarkdownReadView.tsx src/content/index.tsx src/viewer/viewer-entry.tsx vscode-extension/src/MarkdownPreviewProvider.ts vscode-extension/webview/entry.tsx vscode-extension/tests/MarkdownPreviewProvider.test.ts vscode-extension/tests/webview-message.test.tsx
git commit -m "feat: propagate Markdown source context across previews"
```

### Task 5: 实现内部锚点定位和兼容性样式

**Files:**
- Modify: `src/viewer/components/Markdown/FeishuComponents.tsx`
- Create: `src/viewer/components/Markdown/FeishuLink.tsx`
- Modify: `src/viewer/styles/markdown.css`
- Modify: `vscode-extension/src/MarkdownPreviewProvider.ts`
- Modify: `vscode-extension/tests/webview-message.test.tsx`
- Create: `tests/unit/FeishuLink.test.tsx`

**Interfaces:**

```ts
export function FeishuLink(props: React.AnchorHTMLAttributes<HTMLAnchorElement>): ReactElement;
```

- [ ] **Step 1: Write failing link behavior tests**

Render an anchor with `href="#html-table"`, mock the target element’s `scrollIntoView`, click it, and assert the event is prevented, the target is scrolled, and the link does not have `target="_blank"`. Render an external link and assert `target="_blank"` and `rel="noopener noreferrer"` remain.

- [ ] **Step 2: Run link tests to verify they fail**

Run: `TMPDIR=/tmp npx vitest run tests/unit/FeishuLink.test.tsx`

Expected: FAIL because all current links are forced to open in a new tab.

- [ ] **Step 3: Implement FeishuLink**

Treat only `href` values starting with `#` as current-document anchors. Use the nearest `.feishu-markdown-body` root, decode the fragment safely, call `scrollIntoView({ behavior: storedSetting, block: 'start' })`, and call `history.replaceState` inside a guarded try/catch. Keep external and resolved relative links on the existing secure new-tab path.

- [ ] **Step 4: Add compatibility styles**

Add Feishu styles for details/summary, kbd, video, safe HTML div alignment, badge images, and video error/empty states. Use existing theme variables so light/dark and VS Code Webview inherit the same colors. Do not add a global `overflow` rule that changes table scrollports.

- [ ] **Step 5: Update Webview CSP**

Add `media-src ${webview.cspSource} https: data:` to the generated CSP. Keep `img-src` restricted to the Webview resource root, HTTPS and data URLs; do not add `*` or `http:`.

- [ ] **Step 6: Run focused UI tests**

Run: `TMPDIR=/tmp npx vitest run tests/unit/FeishuLink.test.tsx tests/unit/markdown-html-compatibility.test.tsx vscode-extension/tests/webview-message.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/viewer/components/Markdown/FeishuLink.tsx src/viewer/components/Markdown/FeishuComponents.tsx src/viewer/styles/markdown.css vscode-extension/src/MarkdownPreviewProvider.ts vscode-extension/tests/webview-message.test.tsx tests/unit/FeishuLink.test.tsx
git commit -m "feat: handle README anchors and compatibility styling"
```

### Task 6: 补齐 E2E、矩阵状态和发布门禁

**Files:**
- Modify: `tests/e2e/browser/helpers.ts`
- Modify: `tests/e2e/browser/preview.spec.ts`
- Modify: `docs/markdown-compatibility.md`
- Modify: `tests/unit/release-docs.test.ts`
- Modify: `docs/release-acceptance.md`

**Interfaces:**
- Extend `createTempMarkdownFixture(initialContent?: string, fixtureName?: string)` so the existing helper can copy either `all-markdown-features.md` or the root `test-markdown-compatibility.md` into its temporary directory.
- E2E uses the existing browser-extension Playwright project and local fixture helper; no new test server or network mock is introduced.

- [ ] **Step 1: Write failing E2E assertions**

Add scenarios that open the compatibility fixture and assert:

- `details` can be opened/closed and `summary` remains visible.
- `picture source`, badge, contributor image and lazy image attributes exist.
- `kbd`, HTML table and task list render.
- Clicking `#html-table` scrolls the current preview and does not open a new page.
- A dangerous link is absent or inert.

- [ ] **Step 2: Run the new E2E scenarios to verify the missing behavior**

Run: `TMPDIR=/tmp E2E_HEADLESS=1 npm run test:e2e -- --project=browser-extension tests/e2e/browser/preview.spec.ts`

Expected: FAIL on at least the relative URL, anchor, or HTML structure assertions before the implementation tasks are complete.

- [ ] **Step 3: Run the complete validation set**

Run:

```bash
TMPDIR=/tmp npm test -- --run
npm run typecheck
npm run build
npm run build:vscode
npm run verify:vscode
TMPDIR=/tmp npm run verify:release
```

Expected: all commands exit 0; the existing JSDOM Mermaid `getBBox` warning may remain stderr-only and must not change the exit code.

- [ ] **Step 4: Update the matrix from evidence**

Set each row to `PASS` only after the corresponding unit or E2E assertion and both runtime checks are complete. Use `DEGRADED` for a deliberate safe fallback, `UNSUPPORTED` for explicitly out-of-scope HTML, and `BLOCKED` only for a runtime that could not be tested.

- [ ] **Step 5: Update release acceptance documentation**

Add compatibility fixture, relative resource, internal anchor, details, picture, kbd, video, HTML table and dangerous HTML checks to `docs/release-acceptance.md`.

- [ ] **Step 6: Commit the integrated feature**

```bash
git add tests/e2e/browser/helpers.ts tests/e2e/browser/preview.spec.ts docs/markdown-compatibility.md tests/unit/release-docs.test.ts docs/release-acceptance.md
git commit -m "test: verify GitHub Markdown compatibility across runtimes"
```

- [ ] **Step 7: Build and perform manual acceptance**

Install the generated Chrome and VS Code artifacts from the feature branch, open `test-markdown-compatibility.md`, and record Chrome/VS Code results in `docs/markdown-compatibility.md`. Do not publish a version tag until all P0 rows are `PASS` or have an explicitly documented `DEGRADED` fallback.
