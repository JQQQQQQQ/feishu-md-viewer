# 大文档增量解析与渲染实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 1～5 MB 本地 Markdown 文档中，以稳定的顶层块为单位复用未变化内容，降低重复解析和整页重建成本，同时保持现有目录、表格、图片、Mermaid 与滚动状态行为。

**Architecture:** 先增加可观测性和内容级缓存，再建立逐行扫描的顶层块索引与全局标题 / 表格元数据，最后将 `MarkdownReadView` 和本地文件刷新接入块级差异渲染。块边界不可靠时回退到现有整篇 `parseMarkdown`，不在本阶段引入 Worker 或虚拟列表。

**Tech Stack:** React 18、TypeScript、unified/remark/rehype、Zustand、Vitest、Playwright、Vite、Chrome Extension Manifest V3、VS Code WebView。

**Spec:** `docs/superpowers/specs/2026-09-07-large-document-performance-design.md`

## Global Constraints

- 不在本阶段引入 Web Worker、虚拟列表或第三方虚拟滚动库。
- 不改变 Markdown 语义、HTML 安全白名单、资源解析规则或 Mermaid 语法。
- 不改变表格的选择、复制、列宽持久化、横向滚动和目录联动行为。
- 不改变图片预览、目录折叠、锚点跳转、主题和正文对齐设置。
- 无法安全拆分时整篇回退，内容和安全行为与当前实现一致。
- Mermaid 继续按可视区域懒渲染并按源码缓存 SVG。
- 手动刷新和自动刷新使用同一套差异流程。
- 性能缓存不能包含主题、字号、目录展开状态或表格视图状态。

---

## 文件结构与职责

先按职责锁定文件边界，后续任务不得把索引、缓存和视图状态重新塞回一个大文件：

- 创建 `src/lib/markdown-blocks.ts`：逐行 Markdown 顶层块扫描、内容指纹、块匹配和差异计算。
- 创建 `src/lib/markdown-performance.ts`：开发环境性能采样的 mark/measure 封装，生产环境为空操作。
- 创建 `src/lib/markdown-render-cache.ts`：按内容指纹和来源上下文缓存解析后的 React 元素及块元数据。
- 修改 `src/lib/markdown-pipeline.ts`：抽取可复用的全局元数据扫描、单块解析入口和稳定元数据注入。
- 修改 `src/viewer/components/Markdown/Heading.tsx`：支持传入稳定标题 ID，保留现有默认 ID 行为作为兼容回退。
- 修改 `src/viewer/components/Markdown/MarkdownReadView.tsx`：从整篇 `useMemo` 改为块列表渲染，并保留表格身份、目录定位和锚点恢复副作用。
- 修改 `src/content/index.tsx`：刷新时计算块级差异，统一自动刷新和手动刷新入口，跳过相同内容的重渲染。
- 创建 `tests/unit/markdown-blocks.test.ts`、`tests/unit/markdown-performance.test.ts`、`tests/unit/markdown-render-cache.test.ts`：覆盖纯函数和缓存行为。
- 修改 `tests/unit/markdown-pipeline.test.ts`、`tests/unit/TableOfContents.test.tsx`：覆盖稳定标题 ID、表格元数据和整篇回退兼容。
- 创建 `tests/e2e/browser/large-document-performance.spec.ts`：覆盖 1 MB、3 MB、5 MB 文档和局部刷新。
- 创建 `tests/unit/markdown-refresh-plan.test.ts`：覆盖相同内容、可增量更新内容和整篇回退条件。
- 创建 `tests/fixtures/large-documents/.gitkeep` 及生成脚本 `scripts/perf/generate-markdown-fixtures.mjs`：生成可重复的本地性能样本，不把不可审阅的巨型文件直接提交到源码目录。

## Task 1: 建立性能采样与内容级解析缓存

**Files:**
- Create: `src/lib/markdown-performance.ts`
- Create: `src/lib/markdown-render-cache.ts`
- Modify: `src/lib/markdown-pipeline.ts:244-263`
- Modify: `src/viewer/components/Markdown/MarkdownReadView.tsx:44-125`
- Test: `tests/unit/markdown-performance.test.ts`
- Test: `tests/unit/markdown-render-cache.test.ts`
- Test: `tests/unit/markdown-pipeline.test.ts`

**Interfaces:**
- `measureMarkdownPhase<T>(name: string, task: () => T): T`
- `markMarkdownPhase(name: string): void`
- `getMarkdownContentHash(content: string): string`
- `getMarkdownSourceContextKey(sourceContext?: MarkdownSourceContext): string`
- `getCachedMarkdownRender(key: string): CachedMarkdownRender | undefined`
- `setCachedMarkdownRender(key: string, value: CachedMarkdownRender): void`
- `clearMarkdownRenderCache(): void`
- `CachedMarkdownRender = { key: string; contentHash: string; sourceContextKey: string; rendered: ReactElement; createdAt: number }`

- [ ] **Step 1: Write failing tests for deterministic hashes and cache eviction**

```ts
it('returns the same hash for the same content and different hash after a content change', () => {
  expect(getMarkdownContentHash('# A')).toBe(getMarkdownContentHash('# A'));
  expect(getMarkdownContentHash('# A')).not.toBe(getMarkdownContentHash('# B'));
});

it('separates cache entries by source context and keeps only current plus previous entries', () => {
  const first = makeCachedRender('file:///a.md', 'one');
  const second = makeCachedRender('file:///a.md', 'two');
  const third = makeCachedRender('file:///a.md', 'three');
  setCachedMarkdownRender(first.key, first);
  setCachedMarkdownRender(second.key, second);
  setCachedMarkdownRender(third.key, third);
  expect(getCachedMarkdownRender(first.key)).toBeUndefined();
  expect(getCachedMarkdownRender(third.key)).toBe(third);
});
```

Run: `npm test -- --run tests/unit/markdown-performance.test.ts tests/unit/markdown-render-cache.test.ts`

Expected: FAIL because the hash and cache modules do not exist.

- [ ] **Step 2: Implement the minimal performance helper and bounded cache**

Implement a FNV-1a string hash returning a stable base-36 string. Build the cache key as
`<contentHash>::<sourceContextKey>`. Keep an insertion-ordered `Map`, delete the oldest entry
when the size exceeds two, and expose `clearMarkdownRenderCache()` for test isolation. In
`measureMarkdownPhase`, call `performance.mark/measure` only when `import.meta.env.DEV` and
the APIs exist; always return the task result and never let instrumentation throw.

- [ ] **Step 3: Wrap the current full parse with the cache without changing DOM structure**

In `parseMarkdown`, compute the cache key only at the document entry point and surround the
existing unified pipeline with `measureMarkdownPhase('markdown-parse', ...)`. Return the cached
React element on a hit. Do not cache results with missing or invalid source context, and do not
move table identity or anchor side effects into the cache.

- [ ] **Step 4: Add regression tests for the existing parse behavior**

Extend `tests/unit/markdown-pipeline.test.ts` to assert that repeated parsing still returns the
same visible heading/table/Mermaid structure and that XSS sanitization remains unchanged after a
cache hit. Verify `parseMarkdown('')` and no-context parsing remain supported.

Run: `npm test -- --run tests/unit/markdown-pipeline.test.ts tests/unit/markdown-performance.test.ts tests/unit/markdown-render-cache.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the independently testable cache slice**

```bash
git add src/lib/markdown-performance.ts src/lib/markdown-render-cache.ts src/lib/markdown-pipeline.ts src/viewer/components/Markdown/MarkdownReadView.tsx tests/unit/markdown-performance.test.ts tests/unit/markdown-render-cache.test.ts tests/unit/markdown-pipeline.test.ts
git commit -m "perf: 增加 Markdown 解析采样与缓存"
```

## Task 2: 实现顶层块索引和安全差异匹配

**Files:**
- Create: `src/lib/markdown-blocks.ts`
- Create: `tests/unit/markdown-blocks.test.ts`
- Modify: `src/lib/markdown-performance.ts`

**Interfaces:**
- `MarkdownBlockKind` 为 spec 中定义的 `heading | paragraph | list | blockquote | table | code | mermaid | image | html | thematic-break | unknown` 联合类型。
- `MarkdownBlock = { kind: MarkdownBlockKind; source: string; startLine: number; endLine: number; contentHash: string; headingPath: string[]; renderKey: string; boundaryConfidence: 'safe' | 'unsafe' }`
- `indexMarkdownBlocks(content: string): MarkdownBlock[]`
- `diffMarkdownBlocks(previous: MarkdownBlock[], next: MarkdownBlock[]): MarkdownBlockDiff`
- `MarkdownBlockDiff = { unchanged: MarkdownBlock[]; added: MarkdownBlock[]; removed: MarkdownBlock[]; changed: Array<{ previous: MarkdownBlock; next: MarkdownBlock }>; requiresFullParse: boolean; fallbackReason?: string }`

- [ ] **Step 1: Write failing boundary tests**

Cover all of the following as separate tests: fenced JavaScript code containing blank lines,
fenced Mermaid, indented code, nested lists, consecutive blockquotes, GFM table separator and
rows, paired `<details>...</details>` HTML, an image-only paragraph, a thematic break, and a
heading followed by a paragraph. Assert exact `startLine`, `endLine`, `kind`, and `source`.

```ts
it('does not split a fenced Mermaid block at internal blank lines', () => {
  const blocks = indexMarkdownBlocks('```mermaid\ngraph TD\n\nA-->B\n```');
  expect(blocks).toHaveLength(1);
  expect(blocks[0]).toMatchObject({ kind: 'mermaid', startLine: 1, endLine: 4 });
});
```

Run: `npm test -- --run tests/unit/markdown-blocks.test.ts`

Expected: FAIL because the scanner is not implemented.

- [ ] **Step 2: Implement the line scanner with explicit state**

Split with `content.split(/\r?\n/)`, keep one-based line numbers, and scan fenced code before
ordinary blocks. Track fence character/length, HTML tag depth, list indentation, and the current
heading path. A table is recognized only when a candidate header is immediately followed by a GFM
separator row. On an unclosed fence or paired HTML block, emit one `unknown` block with
`boundaryConfidence: 'unsafe'` and set the diff fallback reason instead of guessing a boundary.

- [ ] **Step 3: Add deterministic block hashes and matching**

Hash the exact block source including line content but excluding line numbers. Match old/new blocks
by `kind + contentHash + headingPath` using a forward occurrence queue so duplicate paragraphs do
not collapse into one block. Preserve the previous `renderKey` for matched blocks; assign a new
key only to added blocks. Set `requiresFullParse` when either index has an unsafe block or when a
heading change invalidates the complete heading path map.

- [ ] **Step 4: Verify scanner and diff behavior**

Add tests for: inserting a paragraph before an unchanged table (the table keeps its old
`renderKey`), editing one paragraph (one `changed` item), deleting a Mermaid block, duplicate
identical paragraphs, and an unterminated fence (full fallback). Run:

`npm test -- --run tests/unit/markdown-blocks.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the block-index slice**

```bash
git add src/lib/markdown-blocks.ts src/lib/markdown-performance.ts tests/unit/markdown-blocks.test.ts
git commit -m "perf: 增加 Markdown 顶层块索引"
```

## Task 3: 统一标题 ID、表格元数据和单块解析入口

**Files:**
- Modify: `src/lib/markdown-pipeline.ts:202-263`
- Modify: `src/viewer/components/Markdown/Heading.tsx:1-110`
- Modify: `src/viewer/hooks/useTOC.ts:1-120`
- Modify: `tests/unit/markdown-pipeline.test.ts`
- Modify: `tests/unit/TableOfContents.test.tsx`

**Interfaces:**
- `MarkdownHeadingMetadata = { id: string; level: number; text: string; path: string[]; isDocumentTitle: boolean }`
- `MarkdownTableMetadata = { path: string; ordinal: number; id: string }`
- `MarkdownDocumentMetadata = { headings: Map<string, MarkdownHeadingMetadata>; tables: Map<string, MarkdownTableMetadata> }`
- `collectMarkdownDocumentMetadata(blocks: MarkdownBlock[]): MarkdownDocumentMetadata`
- `parseMarkdownBlock(block: MarkdownBlock, sourceContext: MarkdownSourceContext | undefined, metadata: MarkdownDocumentMetadata): ReactElement`
- `FeishuHeadingProps` 增加可选 `id?: string`，传入时直接使用，不传入时继续调用现有 `createHeadingId`。

- [ ] **Step 1: Write failing stability tests**

Add a test that parses two versions where a paragraph is inserted before a duplicate heading and
asserts existing heading IDs remain unique and unchanged. Add a table test that inserts a table
in another heading section and asserts an existing table's `data-feishu-table-id`, path and
ordinal metadata remain addressable by the table identity matcher.

```ts
it('keeps heading ids stable when an earlier block is inserted', () => {
  const before = collectMarkdownDocumentMetadata(indexMarkdownBlocks('# A\n\n## Same\n\n## Same'));
  const after = collectMarkdownDocumentMetadata(indexMarkdownBlocks('# A\n\nnew\n\n## Same\n\n## Same'));
  expect(after.headings.get('2:1')?.id).toBe(before.headings.get('2:1')?.id);
  expect(after.headings.get('2:2')?.id).toBe(before.headings.get('2:2')?.id);
});
```

Run: `npm test -- --run tests/unit/markdown-pipeline.test.ts tests/unit/TableOfContents.test.tsx`

Expected: FAIL until metadata is collected globally and injected into headings/tables.

- [ ] **Step 2: Extract a shared heading metadata collector**

Use the same heading text normalization and level rules as `useTOC`. Generate IDs through one
unique factory for the whole document, record parent paths, and mark the first level-1 heading as
the document title. Keep the collector pure and do not read React state or DOM APIs.

- [ ] **Step 3: Update the pipeline for metadata injection and block parsing**

Refactor the current rehype transforms so `rehypeAssignTableIds` accepts precomputed metadata and
`parseMarkdownBlock` can parse one block with the existing sanitize/resource/component pipeline.
Preserve `rehypeSectionHierarchy` for full-document parsing. For block parsing, return the same
heading class, table data attributes, Mermaid wrapper and HTML sanitization output as the current
pipeline, while passing the stable heading ID to `FeishuHeading`.

- [ ] **Step 4: Verify existing TOC, anchors, table persistence and sanitization**

Run the focused unit tests and extend assertions for: duplicate headings, explicit HTML IDs,
table `data-feishu-table-path` / ordinal values, and unsafe HTML. Expected result: all current
tests pass without changed visible semantics.

- [ ] **Step 5: Commit the metadata slice**

```bash
git add src/lib/markdown-pipeline.ts src/viewer/components/Markdown/Heading.tsx src/viewer/hooks/useTOC.ts tests/unit/markdown-pipeline.test.ts tests/unit/TableOfContents.test.tsx
git commit -m "perf: 稳定 Markdown 标题与表格元数据"
```

## Task 4: 将阅读视图切换为块级复用并保留现有副作用

**Files:**
- Create: `src/viewer/components/Markdown/MarkdownBlockView.tsx`
- Modify: `src/viewer/components/Markdown/MarkdownReadView.tsx:1-127`
- Modify: `src/viewer/components/Markdown/FeishuTableIdentity.ts`
- Create: `tests/unit/MarkdownReadView.incremental.test.tsx`

**Interfaces:**
- `MarkdownBlockViewProps = { block: MarkdownBlock; sourceContext?: MarkdownSourceContext; metadata: MarkdownDocumentMetadata; rendered?: ReactElement }`
- `MarkdownBlockView({ block, sourceContext, metadata, rendered })` renders a stable wrapper with `data-feishu-block-key` and the parsed block element.
- `MarkdownReadView` keeps the existing props `{ content: string; sourceContext?: MarkdownSourceContext }` and adds no public setting.

- [ ] **Step 1: Write failing component tests for DOM reuse**

Render a two-block document, capture each `[data-feishu-block-key]` node, rerender after editing
only the second block, and assert the first node is the same DOM object while the second node is
replaced. Also assert the root retains `.feishu-markdown-body`, table identity events are still
dispatched, and an anchor scroll target is found after rerender.

Run: `npm test -- --run tests/unit/MarkdownReadView.incremental.test.tsx`

Expected: FAIL because the view currently renders one parsed React element without block keys.

- [ ] **Step 2: Add the block view and stable React keys**

Create `MarkdownBlockView` with `key={block.renderKey}` and a non-styling wrapper carrying
`data-feishu-block-key`. Render cached elements for unchanged blocks and call `parseMarkdownBlock`
only for added/changed blocks. Do not add `contentEditable`, event interception, or selection CSS;
existing table and image components must remain the event owners.

- [ ] **Step 3: Preserve section layout and view-state effects**

Keep the existing `.feishu-section` hierarchy by deriving section wrappers from heading levels in
the block list, or by using an equivalent pure layout helper. Keep `syncTableIdentities`, the
`feishu-table-identities-updated` listener, initial hash scrolling, and `ImagePreviewProvider` in
`MarkdownReadView`. Run `markdown-react-commit` around the React list commit and dispatch the
existing table-width update event after remapping IDs.

- [ ] **Step 4: Add full-parse fallback**

When `diffMarkdownBlocks(...).requiresFullParse` is true, render the existing `parseMarkdown`
result under one stable `data-feishu-block-key="full-document"` wrapper. Record
`markdown-refresh-fallback` with the reason in development diagnostics. The fallback must never
blank the document while an asynchronous refresh is in progress.

- [ ] **Step 5: Verify component regressions**

Run:

`npm test -- --run tests/unit/MarkdownReadView.incremental.test.tsx tests/unit/markdown-pipeline.test.ts tests/unit/FeishuTableIdentity.test.ts`

Then run the full unit suite with `npm test`. Expected: PASS and unchanged table selection,
copying, width restoration, image preview and Mermaid lazy-render tests.

- [ ] **Step 6: Commit the incremental read-view slice**

```bash
git add src/viewer/components/Markdown/MarkdownBlockView.tsx src/viewer/components/Markdown/MarkdownReadView.tsx src/viewer/components/Markdown/FeishuTableIdentity.ts tests/unit/MarkdownReadView.incremental.test.tsx
git commit -m "perf: 让 Markdown 阅读视图按块复用"
```

## Task 5: 接入本地文件局部刷新和性能 fixture

**Files:**
- Modify: `src/content/index.tsx:73-171`
- Create: `scripts/perf/generate-markdown-fixtures.mjs`
- Create: `tests/e2e/browser/large-document-performance.spec.ts`
- Create: `tests/fixtures/large-documents/.gitkeep`
- Modify: `package.json`（增加 `perf:fixtures` 脚本）

**Interfaces:**
- `refreshContent(detectedContent?: string)` 保持现有调用签名。
- `createMarkdownRefreshPlan(previousContent: string, nextContent: string, sourceContext?: MarkdownSourceContext): MarkdownRefreshPlan`
- `MarkdownRefreshPlan = { mode: 'noop' | 'incremental' | 'full'; previousHash: string; nextHash: string; diff?: MarkdownBlockDiff; reason?: string }`

- [ ] **Step 1: Write failing refresh-plan and browser tests**

Add unit coverage for same-content `noop`, one-paragraph `incremental`, heading-boundary
`full`, and unsafe-fence `full`. Add an E2E test that opens a generated fixture, modifies one
middle marker through the existing local-file test harness, and checks the visible block key and
scroll position.

```ts
it('does not render when the observed file content is identical', () => {
  expect(createMarkdownRefreshPlan('# A', '# A').mode).toBe('noop');
});
```

Run: `npm test -- --run tests/unit/markdown-refresh-plan.test.ts`

Expected: FAIL because the refresh planner is not yet extracted.

- [ ] **Step 2: Extract a pure refresh planner**

Create `createMarkdownRefreshPlan` using content hashes, block indexes and `diffMarkdownBlocks`.
Return `noop` before any React render when hashes match. Return `full` with a human-readable
development-only reason for unsafe boundaries or heading-path invalidation.

- [ ] **Step 3: Route auto and manual refresh through the planner**

In `src/content/index.tsx`, keep `capturePreviewViewport` before asynchronous reads. For `noop`,
update the monitor baseline and clear pending state without calling `root.render`. For
`incremental` or `full`, update `currentContent` and render once with the new content; preserve
the current loading flag, `contentUpdateAvailable` behavior, and `restorePreviewViewport` timing.
Both auto mode and the manual refresh button must call this same `refreshContent` path.

- [ ] **Step 4: Add deterministic fixture generation**

Implement `scripts/perf/generate-markdown-fixtures.mjs` with `--size=1|3|5` and an output directory
argument. Generate headings, paragraphs, nested lists, GFM tables, fenced code, Mermaid blocks,
images, blockquotes and HTML details using a seeded loop. Include a unique marker every 50 KB so
the E2E harness can edit one known block. Add:

```json
"perf:fixtures": "node scripts/perf/generate-markdown-fixtures.mjs"
```

Do not commit generated multi-megabyte files; CI and local verification generate them on demand.

- [ ] **Step 5: Add 1/3/5 MB E2E and performance assertions**

Open each generated fixture in the browser harness, wait for the first visible heading and first
Mermaid block, and collect `performance.getEntriesByName` for `markdown-index`,
`markdown-parse`, `markdown-react-commit`, `markdown-refresh-diff` and `mermaid-first-render`.
For the middle-marker edit, assert that an unchanged block keeps the same DOM node, the document
does not jump to the top, and the relevant table / Mermaid state remains usable. Use generous
non-flaky ceilings only for catastrophic regressions (for example, no phase may throw or remain
unresolved); print timings for trend tracking instead of enforcing machine-specific absolute ms
budgets.

- [ ] **Step 6: Run all verification commands**

```bash
npm run typecheck
npm test
npm run build
npm run build:vscode
npm run verify:vscode
npm run perf:fixtures -- --size=1 --output-dir=/tmp/feishu-md-fixtures
npm run test:e2e -- tests/e2e/browser/large-document-performance.spec.ts
git diff --check
```

Expected: all commands pass; generated fixture files remain outside Git; browser E2E output lists
the five performance phases for all three sizes.

- [ ] **Step 7: Commit the refresh and E2E slice**

```bash
git add src/content/index.tsx src/lib/markdown-blocks.ts scripts/perf/generate-markdown-fixtures.mjs tests/e2e/browser/large-document-performance.spec.ts tests/fixtures/large-documents/.gitkeep package.json
git commit -m "perf: 接入 Markdown 局部刷新与大文档验收"
```

## Task 6: 发布前回归与结果记录

**Files:**
- Create: `docs/superpowers/reports/2026-09-07-large-document-performance-verification.md`
- Modify: `docs/superpowers/specs/2026-09-07-large-document-performance-design.md` only if an accepted implementation deviation is discovered.

- [ ] **Step 1: Run the complete verification matrix**

Record the exact command, pass/fail result, fixture size, browser environment and measured phase
entries. Include separate notes for Chrome content script and VS Code WebView builds.

- [ ] **Step 2: Review the diff for scope and fallback safety**

Confirm no changes to HTML sanitize allowlists, table selection handlers, Mermaid syntax, user
settings, or image preview controls. Confirm that a parser exception, unsafe block boundary, or
unknown cache version leaves the old visible content in place until the replacement is ready.

- [ ] **Step 3: Commit the verification report**

```bash
git add docs/superpowers/reports/2026-09-07-large-document-performance-verification.md
git commit -m "test: 记录大文档性能验收结果"
```
