# 大文档渐进渲染实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为超过阈值的 Markdown 文档增加分批正文渲染、低负载目录和有界 Mermaid 调度，降低首次打开与滚动卡顿，同时保持普通文档和现有表格/锚点行为不变。

**Architecture:** 在现有 `MarkdownReadView` 外增加可取消的渐进渲染控制器；小文档继续使用同步模型，大文档先提交首批块，再通过 idle/frame 调度后续批次。目录根据同一份文档规模进入大目录模式，Mermaid 通过统一队列限制渲染并发。所有新策略均由纯函数阈值和可测试调度器驱动，避免把计时器逻辑散落到组件中。

**Tech Stack:** React 18、TypeScript、Vitest、IntersectionObserver、`requestIdleCallback`/`requestAnimationFrame`、现有 unified Markdown 管线。

**Spec:** `docs/superpowers/specs/2026-09-10-large-document-progressive-rendering-design.md`

## Global Constraints

- 小文档继续沿用现有同步渲染路径，阈值以内不得改变目录默认展开和正文布局。
- 所有调度任务必须可取消，旧内容不得覆盖新内容。
- 不引入第三方虚拟列表依赖，不改写表格选择、表格宽度和 Mermaid SVG 样式。
- 现有 `data-feishu-block-key`、表格身份事件和锚点定位接口必须保持兼容。
- 测试和文档使用简体中文；不得覆盖工作区已有未提交文件。

---

### Task 1: 建立大文档策略与批次纯函数

**Files:**
- Create: `src/lib/markdown-progressive-render.ts`
- Test: `tests/unit/markdown-progressive-render.test.ts`

**Interfaces:**
- `LARGE_DOCUMENT_BLOCK_THRESHOLD = 1200`
- `LARGE_DOCUMENT_HEADING_THRESHOLD = 500`
- `LARGE_DOCUMENT_MERMAID_THRESHOLD = 80`
- `MARKDOWN_RENDER_BATCH_SIZE = 80`
- `classifyMarkdownRenderStrategy(input): 'sync' | 'progressive'`
- `chunkMarkdownBlocks(blocks, batchSize): MarkdownBlock[][]`
- `getInitialMarkdownBatchCount(totalBatches): number`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  classifyMarkdownRenderStrategy,
  chunkMarkdownBlocks,
  getInitialMarkdownBatchCount,
} from '@/lib/markdown-progressive-render';

describe('markdown progressive render strategy', () => {
  it('keeps ordinary documents on synchronous rendering', () => {
    expect(classifyMarkdownRenderStrategy({ blockCount: 1199, headingCount: 499, mermaidCount: 79 }))
      .toBe('sync');
  });

  it('enables progressive rendering when any large-document threshold is reached', () => {
    expect(classifyMarkdownRenderStrategy({ blockCount: 1200, headingCount: 0, mermaidCount: 0 }))
      .toBe('progressive');
    expect(classifyMarkdownRenderStrategy({ blockCount: 0, headingCount: 500, mermaidCount: 0 }))
      .toBe('progressive');
    expect(classifyMarkdownRenderStrategy({ blockCount: 0, headingCount: 0, mermaidCount: 80 }))
      .toBe('progressive');
  });

  it('chunks blocks without losing order', () => {
    const blocks = Array.from({ length: 165 }, (_, index) => ({ renderKey: `block-${index}` }));
    const chunks = chunkMarkdownBlocks(blocks, 80);
    expect(chunks.map((chunk) => chunk.length)).toEqual([80, 80, 5]);
    expect(chunks.flat().map((block) => block.renderKey)).toEqual(blocks.map((block) => block.renderKey));
  });

  it('renders at least one batch immediately', () => {
    expect(getInitialMarkdownBatchCount(0)).toBe(0);
    expect(getInitialMarkdownBatchCount(5)).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
TMPDIR=/tmp npm test -- --run tests/unit/markdown-progressive-render.test.ts
```

Expected: FAIL because the strategy module and exported functions do not exist yet.

- [ ] **Step 3: Implement the pure strategy module**

Implement the constants, threshold comparison, stable chunking and initial-batch helper. The functions must not access `window`, timers or React so they can run in the existing Vitest environment.

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
TMPDIR=/tmp npm test -- --run tests/unit/markdown-progressive-render.test.ts
```

Expected: all strategy tests pass.

- [ ] **Step 5: Commit the task**

```bash
git add src/lib/markdown-progressive-render.ts tests/unit/markdown-progressive-render.test.ts
git commit -m "perf: 增加大文档渐进渲染策略"
```

### Task 2: 增加可取消的批次调度器

**Files:**
- Modify: `src/lib/markdown-progressive-render.ts`
- Test: `tests/unit/markdown-progressive-render.test.ts`

**Interfaces:**
- `createProgressiveRenderScheduler(options): ProgressiveRenderScheduler`
- `ProgressiveRenderScheduler.start(totalBatches, onBatch): void`
- `ProgressiveRenderScheduler.cancel(): void`
- `ProgressiveRenderScheduler.isCurrent(version): boolean`

- [ ] **Step 1: Write the failing scheduler tests**

Add tests that use injected `schedule` and `cancelSchedule` functions rather than real timers:

```ts
it('commits the first batch immediately and schedules the remaining batches', () => {
  const scheduled: Array<() => void> = [];
  const committed: number[] = [];
  const scheduler = createProgressiveRenderScheduler({
    schedule: (callback) => scheduled.push(callback),
    cancelSchedule: () => undefined,
  });

  scheduler.start(3, (batchIndex) => committed.push(batchIndex));
  expect(committed).toEqual([0]);
  scheduled.shift()?.();
  expect(committed).toEqual([0, 1]);
  scheduled.shift()?.();
  expect(committed).toEqual([0, 1, 2]);
});

it('cancels old work so stale batches cannot commit', () => {
  const scheduled: Array<() => void> = [];
  const committed: number[] = [];
  const scheduler = createProgressiveRenderScheduler({
    schedule: (callback) => scheduled.push(callback),
    cancelSchedule: () => undefined,
  });

  scheduler.start(3, (batchIndex) => committed.push(batchIndex));
  scheduler.cancel();
  scheduled.shift()?.();
  expect(committed).toEqual([0]);
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run:

```bash
TMPDIR=/tmp npm test -- --run tests/unit/markdown-progressive-render.test.ts
```

Expected: FAIL because the scheduler factory is not implemented.

- [ ] **Step 3: Implement the scheduler**

Use an incrementing generation number. Commit batch zero synchronously; schedule each later batch through the injected scheduler. Before invoking `onBatch`, check that the generation is still current. `cancel()` increments the generation and cancels the pending handle.

- [ ] **Step 4: Run the focused tests**

Run:

```bash
TMPDIR=/tmp npm test -- --run tests/unit/markdown-progressive-render.test.ts
```

Expected: all strategy and scheduler tests pass.

- [ ] **Step 5: Commit the task**

```bash
git add src/lib/markdown-progressive-render.ts tests/unit/markdown-progressive-render.test.ts
git commit -m "perf: 增加可取消的大文档批次调度"
```

### Task 3: 接入 MarkdownReadView 的大文档分批提交

**Files:**
- Modify: `src/viewer/components/Markdown/MarkdownReadView.tsx`
- Modify: `src/viewer/components/Markdown/MarkdownBlockView.tsx`
- Test: `tests/unit/MarkdownReadView.incremental.test.tsx`
- Test: `tests/unit/markdown-progressive-render.test.ts`

**Interfaces:**
- `MarkdownRenderModel` gains `strategy`, `batches`, `committedBatchCount` and the existing `renderedByKey` map remains the reuse source.
- `MarkdownBlockView` accepts an optional `placeholder` flag while retaining `data-feishu-block-key`.

- [ ] **Step 1: Write failing component tests**

Add tests for:

```ts
it('large documents commit the first batch before later batches', async () => {
  const content = createLargeMarkdownFixture(1200);
  const view = render(<MarkdownReadView content={content} />);
  expect(view.container.querySelectorAll('[data-feishu-block-key]').length).toBeGreaterThan(0);
  expect(view.container.querySelector('[data-feishu-progressive-placeholder]')).not.toBeNull();
  await waitFor(() => expect(view.container.querySelector('[data-feishu-progressive-placeholder]')).toBeNull());
});

it('does not let a cancelled old content batch replace newer content', async () => {
  const view = render(<MarkdownReadView content={createLargeMarkdownFixture(1200, 'old')} />);
  view.rerender(<MarkdownReadView content={createLargeMarkdownFixture(1200, 'new')} />);
  await waitFor(() => expect(view.container).toHaveTextContent('new'));
  expect(view.container).not.toHaveTextContent('old-only-marker');
});
```

The fixture helper should produce plain headings and paragraphs without thousands of Mermaid diagrams so the test isolates batch behavior.

- [ ] **Step 2: Run the component tests and verify they fail**

Run:

```bash
TMPDIR=/tmp npm test -- --run tests/unit/MarkdownReadView.incremental.test.tsx
```

Expected: FAIL because the view currently renders all blocks synchronously and has no progressive placeholder.

- [ ] **Step 3: Implement the large-document model**

After indexing blocks, collect heading and Mermaid counts, classify the strategy, and preserve the current synchronous branch for small documents. For the progressive branch, build the same rendered block map in batches and expose only the committed batches to the render tree. Use the scheduler from Task 2 and cancel it in an effect cleanup when `content` or `sourceContext` changes.

Uncommitted blocks must render a stable placeholder with a minimum height estimate derived from source line count. The placeholder must not contain a fake heading ID, so anchor observers cannot select it as a target.

- [ ] **Step 4: Preserve table identity and anchor behavior**

Keep the existing `useLayoutEffect` table identity synchronization after every committed batch. For an anchor hash targeting a not-yet-committed heading, expose a callback/ref that commits batches through the target block before calling `scrollIntoView`.

- [ ] **Step 5: Run focused tests and inspect DOM reuse**

Run:

```bash
TMPDIR=/tmp npm test -- --run tests/unit/MarkdownReadView.incremental.test.tsx tests/unit/markdown-progressive-render.test.ts
```

Expected: first-batch, cancellation, existing unchanged-DOM and table-width tests pass.

- [ ] **Step 6: Commit the task**

```bash
git add src/viewer/components/Markdown/MarkdownReadView.tsx src/viewer/components/Markdown/MarkdownBlockView.tsx tests/unit/MarkdownReadView.incremental.test.tsx tests/unit/markdown-progressive-render.test.ts
git commit -m "perf: 让大文档正文分批渲染"
```

### Task 4: 降低大目录的 DOM 和标题观察开销

**Files:**
- Modify: `src/viewer/hooks/useTOC.ts`
- Modify: `src/viewer/components/TOC/TableOfContents.tsx`
- Modify: `src/viewer/components/TOC/TOCItem.tsx`
- Test: `tests/unit/useTOC.test.ts`
- Test: `tests/unit/TableOfContents.test.tsx`

**Interfaces:**
- `TOCItem` gains optional `largeDocumentMode?: boolean` and `initialExpanded?: boolean`.
- `TableOfContents` receives optional `largeDocumentMode?: boolean` and `onEnsureHeading?: (id: string) => void`.
- `useTOC` exposes `countTOCItems(items): number` or an equivalent pure count helper for strategy selection.

- [ ] **Step 1: Write failing large-directory tests**

Cover these behaviors:

```ts
it('keeps ordinary TOC items expanded by default', () => {
  const items = extractHeadings('# Title\n\n## Child');
  expect(items[0]?.children).toHaveLength(1);
});

it('marks a large TOC without eagerly rendering every nested branch', () => {
  const view = render(<TableOfContents items={createLargeTOC()} containerRef={containerRef} largeDocumentMode />);
  expect(view.container.querySelectorAll('[role="treeitem"]').length).toBeLessThan(300);
});
```

- [ ] **Step 2: Run focused TOC tests and verify failure**

Run:

```bash
TMPDIR=/tmp npm test -- --run tests/unit/useTOC.test.ts tests/unit/TableOfContents.test.tsx
```

Expected: the large-mode test fails because all nested items are currently rendered and expanded.

- [ ] **Step 3: Implement large-directory rendering**

Keep all TOC data in memory, but pass a large-document flag from `PreviewRoot`. In large mode, render only the root and first visible child level initially; preserve the existing toggle button to expand a branch on demand. Ensure the first document title remains visible and bold.

- [ ] **Step 4: Limit heading observers**

In large mode, observe only headings that have a mounted block node and maintain a bounded window around the current active heading. Disconnect the previous observer before replacing the window. Do not change the existing observer behavior for small documents.

- [ ] **Step 5: Ensure deferred anchor navigation**

When a TOC item points to a heading not currently mounted, call `onEnsureHeading` before looking up the DOM element. After the callback resolves, run the existing highlight and scroll behavior.

- [ ] **Step 6: Run focused tests and commit**

```bash
TMPDIR=/tmp npm test -- --run tests/unit/useTOC.test.ts tests/unit/TableOfContents.test.tsx
git add src/viewer/hooks/useTOC.ts src/viewer/components/TOC/TableOfContents.tsx src/viewer/components/TOC/TOCItem.tsx src/viewer/PreviewRoot.tsx tests/unit/useTOC.test.ts tests/unit/TableOfContents.test.tsx
git commit -m "perf: 降低大目录渲染与观察开销"
```

### Task 5: 为 Mermaid 增加有界渲染队列回归覆盖

**Files:**
- Modify: `src/lib/mermaid-init.ts`
- Modify: `src/viewer/components/Markdown/MermaidBlock.tsx`
- Test: `tests/unit/mermaid-init.test.ts`
- Test: `tests/unit/mermaid-preview-only.test.tsx`

**Interfaces:**
- `renderMermaid` 保留现有签名。
- 增加可测试的 `getMermaidQueueState()` 或测试注入点，只在测试环境暴露队列计数，不改变生产 API。

- [ ] **Step 1: Write failing queue tests**

验证同一时刻只有一个 `renderMermaidNow` 任务执行，以及组件卸载/代码变化后旧结果不会写回。

- [ ] **Step 2: Run focused Mermaid tests and verify failure**

```bash
TMPDIR=/tmp npm test -- --run tests/unit/mermaid-init.test.ts tests/unit/mermaid-preview-only.test.tsx
```

- [ ] **Step 3: Implement bounded queue and cancellation guards**

保留现有 SVG 缓存和顺序队列，在 MermaidBlock 的 effect 中使用版本标识；任务完成后只有版本仍然匹配且组件仍挂载时才更新 SVG/错误状态。

- [ ] **Step 4: Run focused tests and commit**

```bash
TMPDIR=/tmp npm test -- --run tests/unit/mermaid-init.test.ts tests/unit/mermaid-preview-only.test.tsx
git add src/lib/mermaid-init.ts src/viewer/components/Markdown/MermaidBlock.tsx tests/unit/mermaid-init.test.ts tests/unit/mermaid-preview-only.test.tsx
git commit -m "perf: 限制大文档 Mermaid 渲染任务"
```

### Task 6: 完善大文档性能测试与构建验收

**Files:**
- Modify: `tests/e2e/browser/large-document-performance.spec.ts`
- Modify: `scripts/perf/generate-markdown-fixtures.mjs`
- Test: `tests/unit/markdown-performance.test.ts`
- Create: `docs/superpowers/reports/2026-09-10-large-document-progressive-rendering-verification.md`

- [ ] **Step 1: 调整 fixture 分布**

保留 1 MB、3 MB、5 MB 文件大小，但把标题、表格和 Mermaid 的密度调整到可代表真实 README 的范围；另保留一个专门的“高目录密度” fixture 用于目录压力测试，避免所有性能测试都被两万个目录节点主导。

- [ ] **Step 2: 增加首批与最终补齐断言**

E2E 记录首批可见时间、完整块数、局部刷新后的未修改节点连接状态和滚动位置。测试失败时输出 `performance.measure` 中的 `markdown-index`、`markdown-parse`、`markdown-react-commit` 和刷新差异耗时。

- [ ] **Step 3: 运行完整验证**

```bash
TMPDIR=/tmp npm test -- --run
npm run typecheck
npm run build
npm run build:vscode
npm run verify:vscode
TMPDIR=/tmp npm run test:e2e -- tests/e2e/browser/large-document-performance.spec.ts
```

如果当前容器仍因 Chromium `SIGTRAP` 无法启动，记录为环境阻塞，并在 Windows 图形环境中复跑 E2E，不把启动失败误判为页面断言失败。

- [ ] **Step 4: 记录验收结果并提交**

在验证报告中记录测试数量、构建产物、首批和完整补齐耗时、E2E 环境限制及手工验收步骤，然后提交：

```bash
git add tests/e2e/browser/large-document-performance.spec.ts scripts/perf/generate-markdown-fixtures.mjs tests/unit/markdown-performance.test.ts docs/superpowers/reports/2026-09-10-large-document-progressive-rendering-verification.md
git commit -m "test: 增加大文档渐进渲染验收"
```
