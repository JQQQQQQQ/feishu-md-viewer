# Mermaid Preview Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Mermaid 预览弹窗改造成稳定、纯净、文档优先的沉浸式画布，支持按需显示底部工具栏、可预测的滚动/拖拽/缩放和快速关闭。

**Architecture:** 保留现有 `MermaidToolbar` 负责打开预览、复制源码和导出；将预览交互状态集中在 `MermaidPreviewModal`，通过一个不可变的画布交互状态和一次布局帧同步滚动边界。CSS 只负责视觉层和工具栏浮层显隐，不改变画布布局尺寸。

**Tech Stack:** React 18、TypeScript 5、Vitest + Testing Library、Playwright、CSS Variables、现有 Mermaid SVG 清理工具。

**Spec:** `docs/superpowers/specs/2026-08-28-mermaid-preview-design.md`

## Global Constraints

- 普通滚轮只做上下滚动；Shift + 滚轮做横向滚动；普通滚轮不触发缩放。
- 只有按住空格且指针在画布内时才允许拖拽平移，未按空格时不阻断图表内部文本/链接交互。
- 工具栏显示/隐藏只能改变 opacity、transform 和 pointer-events，不改变 canvas padding、scrollWidth 或图表布局。
- 首次测量和初始滚动位置完成后再显示最终画布，避免先偏移后归位的闪动。
- 预览弹窗使用 E2 纯净主题背景和图表细边框/轻阴影，深色主题不得使用纯黑块吞掉边界。
- 点击 overlay 空白处和 Escape 关闭；点击 dialog、canvas、toolbar 不关闭；关闭后焦点恢复正文预览按钮。
- Mermaid 正文源码复制、SVG/PNG 导出继续保留在正文工具栏，本次不把它们移入预览工具栏。

---

### Task 1: 建立预览交互的失败测试基线

**Files:**
- Modify: `tests/unit/mermaid-preview-only.test.tsx`
- Modify: `tests/e2e/browser/preview.spec.ts`

**Interfaces:**
- Consumes: 现有 `MermaidToolbar` 和 `MermaidPreviewModal` 的 aria labels、CSS 类名。
- Produces: 后续任务必须满足的 DOM 和事件契约：`.mermaid-preview-toolbar--visible`、`.mermaid-preview-bottom-hit-area`、`.mermaid-preview-canvas--space-pan`，以及 `onClose` 的 overlay/focus 行为。

- [ ] **Step 1: 写单元测试，锁定未实现行为**

在 `mermaid-preview-only.test.tsx` 中增加以下测试。测试使用 `fireEvent`，不依赖真实布局数值：

```tsx
it('默认隐藏底部工具栏，进入底部热区后显示且不改变画布结构', () => {
  renderToolbar();
  fireEvent.click(screen.getByRole('button', { name: 'Preview Mermaid diagram' }));
  const dialog = screen.getByRole('dialog', { name: 'Mermaid diagram preview' });
  const toolbar = dialog.querySelector('.mermaid-preview-toolbar');
  const hitArea = dialog.querySelector('.mermaid-preview-bottom-hit-area');
  expect(toolbar).toHaveClass('mermaid-preview-toolbar--hidden');
  expect(hitArea).not.toBeNull();
  fireEvent.pointerEnter(hitArea!);
  expect(toolbar).toHaveClass('mermaid-preview-toolbar--visible');
});

it('只在按住空格时进入画布平移状态', () => {
  renderToolbar();
  fireEvent.click(screen.getByRole('button', { name: 'Preview Mermaid diagram' }));
  const canvas = screen.getByRole('dialog').querySelector('.mermaid-preview-canvas')!;
  fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
  expect(canvas).not.toHaveClass('mermaid-preview-canvas--space-pan');
  fireEvent.keyDown(window, { key: ' ' });
  expect(canvas).toHaveClass('mermaid-preview-canvas--space-pan');
  fireEvent.keyUp(window, { key: ' ' });
});

it('点击遮罩关闭，点击画布内容不关闭', () => {
  renderToolbar();
  fireEvent.click(screen.getByRole('button', { name: 'Preview Mermaid diagram' }));
  const dialog = screen.getByRole('dialog', { name: 'Mermaid diagram preview' });
  const overlay = dialog.parentElement!;
  fireEvent.pointerDown(dialog.querySelector('.mermaid-preview-canvas')!);
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(overlay);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'Preview Mermaid diagram' })).toHaveFocus();
});
```

- [ ] **Step 2: 运行失败测试**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx`

Expected: 新增的工具栏、空格平移和 overlay 关闭测试失败；现有预览和滚轮测试继续通过。

- [ ] **Step 3: 增加 E2E 失败场景**

在 `tests/e2e/browser/preview.spec.ts` 的 Mermaid 预览场景后增加：

```ts
test('Mermaid 预览工具栏按需显示并可点击遮罩关闭', async () => {
  const fixture = await createTempMarkdownFixture();
  const context = await createBrowserContext();
  try {
    const page = await context.newPage();
    await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
    await waitForViewer(page);
    const toolbar = viewerLocator(page, '.mermaid-toolbar-wrapper').first();
    await toolbar.hover();
    await toolbar.locator('button[aria-label="Preview Mermaid diagram"]').click();
    const dialog = viewerLocator(page, '[role="dialog"][aria-label="Mermaid diagram preview"]');
    const hitArea = dialog.locator('.mermaid-preview-bottom-hit-area');
    await expect(dialog.locator('.mermaid-preview-toolbar')).toHaveClass(/hidden/);
    await hitArea.hover();
    await expect(dialog.locator('.mermaid-preview-toolbar')).toHaveClass(/visible/);
    await page.mouse.click(8, 8);
    await expect(dialog).toHaveCount(0);
  } finally {
    await context.close();
    await fixture.cleanup();
  }
});
```

- [ ] **Step 4: 运行 E2E 失败测试**

Run: `TMPDIR=/tmp npm run test:e2e -- tests/e2e/browser/preview.spec.ts -g "工具栏按需显示"`

Expected: 新测试因缺少热区和状态类失败。

- [ ] **Step 5: Commit**

```bash
git add tests/unit/mermaid-preview-only.test.tsx tests/e2e/browser/preview.spec.ts
git commit -m "test: define Mermaid preview interaction contract"
```

### Task 2: 实现 B2 工具栏和 F1 关闭行为

**Files:**
- Modify: `src/viewer/components/Mermaid/MermaidPreviewModal.tsx`
- Modify: `src/viewer/styles/mermaid.css`
- Test: `tests/unit/mermaid-preview-only.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `.mermaid-preview-toolbar--hidden/visible`、`.mermaid-preview-bottom-hit-area` 契约。
- Produces: `showToolbar(reason?: 'pointer' | 'keyboard' | 'focus')`、`scheduleToolbarHide()` 的组件内行为；overlay 外部点击调用现有 `onClose`。

- [ ] **Step 1: 写工具栏状态测试的补充断言**

补充测试：`pointerLeave` 180ms 后隐藏、工具栏 `focusin` 保持可见、Escape 关闭且不触发正文快捷键。

- [ ] **Step 2: 运行补充测试确认失败**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx`

Expected: 显隐计时器和 focus/Escape 断言失败。

- [ ] **Step 3: 实现工具栏状态和 overlay 关闭**

在组件中增加：

```tsx
const [toolbarVisible, setToolbarVisible] = useState(false);
const toolbarHideTimerRef = useRef<number | null>(null);

const showToolbar = useCallback(() => {
  if (toolbarHideTimerRef.current !== null) window.clearTimeout(toolbarHideTimerRef.current);
  setToolbarVisible(true);
}, []);

const scheduleToolbarHide = useCallback(() => {
  if (toolbarHideTimerRef.current !== null) window.clearTimeout(toolbarHideTimerRef.current);
  toolbarHideTimerRef.current = window.setTimeout(() => setToolbarVisible(false), 180);
}, []);
```

渲染一个 `.mermaid-preview-bottom-hit-area`，工具栏本身和热区都调用 `showToolbar`；overlay 使用 `onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}`。组件卸载时清理计时器。

- [ ] **Step 4: 调整 CSS 为底部浮层**

将现有顶部 `.mermaid-preview-toolbar` 改为绝对定位的底部胶囊，增加：

```css
.mermaid-preview-toolbar--hidden { opacity: 0; transform: translate(-50%, 10px); pointer-events: none; }
.mermaid-preview-toolbar--visible { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
.mermaid-preview-bottom-hit-area { position: absolute; inset: auto 0 0; height: 56px; z-index: 2; }
```

dialog 不再使用顶部 toolbar 的布局高度；canvas `position: relative`，热区和工具栏浮在 canvas 上方。保留 reduced-motion 分支。

- [ ] **Step 5: 运行单元测试确认通过**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx`

Expected: Mermaid 预览单元测试全部通过。

- [ ] **Step 6: Commit**

```bash
git add src/viewer/components/Mermaid/MermaidPreviewModal.tsx src/viewer/styles/mermaid.css tests/unit/mermaid-preview-only.test.tsx
git commit -m "feat: add immersive Mermaid preview toolbar"
```

### Task 3: 实现 C2 滚轮、Shift 横向和空格平移

**Files:**
- Modify: `src/viewer/components/Mermaid/MermaidPreviewModal.tsx`
- Modify: `src/viewer/styles/mermaid.css`
- Test: `tests/unit/mermaid-preview-only.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 canvas 引用和 toolbar 生命周期。
- Produces: `handleCanvasWheel(event)`；`isSpacePressed` 和 `.mermaid-preview-canvas--space-pan` 状态。

- [ ] **Step 1: 写 wheel/空格平移失败测试**

测试普通 wheel 不改变 zoom，Shift wheel 增加 canvas.scrollLeft，空格按下后 pointer down 才 `preventDefault` 并进入拖拽。

- [ ] **Step 2: 运行测试确认失败**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx`

Expected: Shift 横向和空格状态测试失败，现有普通 wheel 测试继续通过。

- [ ] **Step 3: 实现事件处理**

增加全局 keydown/keyup，仅记录空格状态；wheel 处理遵循：

```tsx
const handleCanvasWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
  if (!event.shiftKey) return; // 纵向由浏览器原生滚动
  const canvas = canvasRef.current;
  if (!canvas) return;
  event.preventDefault();
  const delta = event.deltaX || event.deltaY;
  canvas.scrollLeft += delta;
}, []);
```

pointer down 仅在 `isSpacePressed` 时记录 drag state 并 `preventDefault()`；否则直接返回，不再抢占图表内部交互。

- [ ] **Step 4: 更新拖拽光标和 touch 行为**

`.mermaid-preview-canvas` 默认 `cursor: default`；space 状态显示 `grab`，拖拽中显示 `grabbing`。保留 `touch-action: pan-x pan-y`，不让普通触摸失去原生滚动。

- [ ] **Step 5: 运行单元测试确认通过**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx`

Expected: wheel、Shift 横向和空格平移测试全部通过。

- [ ] **Step 6: Commit**

```bash
git add src/viewer/components/Mermaid/MermaidPreviewModal.tsx src/viewer/styles/mermaid.css tests/unit/mermaid-preview-only.test.tsx
git commit -m "feat: make Mermaid preview document-first scrolling"
```

### Task 4: 实现 D2 定位和稳定缩放边界

**Files:**
- Modify: `src/viewer/components/Mermaid/MermaidPreviewModal.tsx`
- Modify: `src/viewer/styles/mermaid.css`
- Test: `tests/unit/mermaid-preview-only.test.tsx`

**Interfaces:**
- Consumes: 现有 `getFitZoom`、`centerCanvas`、`setZoomFromCenter`。
- Produces: `applyInitialViewport()`、`syncScrollBounds()`；`isViewportReady` 控制首次布局后的显示。

- [ ] **Step 1: 写 D2 定位测试**

覆盖：首次打开前 canvas 使用 `aria-busy="true"` 或 ready 类；调用适应后移除 busy；SVG 没有 width/height 时使用 viewBox；`100%` 恢复实际尺寸并执行一次安全起点定位。

- [ ] **Step 2: 运行测试确认失败**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx`

Expected: 初始 ready、busy 和一次性边界同步断言失败。

- [ ] **Step 3: 实现一次布局帧的初始定位**

使用 `viewportReady`、`requestAnimationFrame` 和清理函数：先计算 D2 zoom，再设置 content 尺寸，下一帧设置 scrollTop/scrollLeft，最后把 canvas 标记为 ready。超宽图保留一个最小可读缩放阈值（不低于 0.75，仍受现有 clamp 限制），从左上安全 padding 开始；短图沿用居中。

- [ ] **Step 4: 收敛缩放滚动更新**

将 `setZoomFromCenter` 和 `fitToCanvas` 的滚动写入统一到一个 `requestAnimationFrame`；每次新请求取消前一个 frame，避免连续按钮点击产生滑块闪动。工具栏显隐不得触发这些函数。

- [ ] **Step 5: 运行单元测试确认通过**

Run: `TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx`

Expected: 定位、100%、适应和普通滚轮回归全部通过。

- [ ] **Step 6: Commit**

```bash
git add src/viewer/components/Mermaid/MermaidPreviewModal.tsx src/viewer/styles/mermaid.css tests/unit/mermaid-preview-only.test.tsx
git commit -m "fix: stabilize Mermaid preview viewport positioning"
```

### Task 5: 完成 E2 主题样式并增加浏览器验收

**Files:**
- Modify: `src/viewer/styles/mermaid.css`
- Modify: `tests/e2e/browser/preview.spec.ts`
- Test: `tests/unit/mermaid-style.test.ts`

**Interfaces:**
- Consumes: Task 2-4 的 DOM 类名和 viewport ready 状态。
- Produces: 浅色/深色主题一致的画布、图表外框和工具栏视觉；完整 E2E 验收场景。

- [ ] **Step 1: 写主题和键盘 E2E 失败测试**

增加场景：浅色/深色主题下 canvas 背景来自主题变量；按 `+`、`-`、`0`、`f` 更新缩放；点击画布后按 Escape 关闭并恢复预览按钮焦点。

- [ ] **Step 2: 运行失败测试**

Run: `TMPDIR=/tmp npm run test:e2e -- tests/e2e/browser/preview.spec.ts -g "Mermaid 预览"`

Expected: 新增快捷键、主题类名和焦点断言失败。

- [ ] **Step 3: 完成 E2 CSS**

移除预览 canvas 点阵背景，使用 `var(--feishu-bg-page)`；`.mermaid-preview-zoom` 使用内容背景、轻边框和主题阴影；补充 `.feishu-viewer--dark` 或现有主题选择器下的阴影和边框对比；dialog 仍保留圆角，外框严格包住 SVG。

- [ ] **Step 4: 完成键盘处理**

在 modal 的 keydown 中加入 `+` / `=` 放大、`-` 缩小、`0` 重置实际尺寸、`f` 适应画布；调用 `showToolbar`，并对 Escape 调用 `preventDefault()` 后关闭。

- [ ] **Step 5: 运行完整验证**

依次运行：

```bash
TMPDIR=/tmp npm test -- --run
TMPDIR=/tmp npm run test:e2e -- tests/e2e/browser/preview.spec.ts
npm run typecheck
npm run build
npm run build:vscode
npm run verify:vscode
```

Expected: 现有单元、Mermaid 预览 E2E、类型检查、Chrome 扩展构建和 VS Code 构建全部通过。

- [ ] **Step 6: Commit**

```bash
git add src/viewer/styles/mermaid.css src/viewer/components/Mermaid/MermaidPreviewModal.tsx tests/unit/mermaid-style.test.ts tests/e2e/browser/preview.spec.ts
git commit -m "test: verify Mermaid preview release experience"
```

### Task 6: 发布前回归与交付

**Files:**
- No new production files; review prior task changes.

**Interfaces:**
- Consumes: Tasks 1-5 的提交和测试结果。
- Produces: 一份可复现的验证记录和待用户实测的构建产物。

- [ ] **Step 1: 检查工作区和提交范围**

Run: `git status --short && git diff HEAD~5..HEAD --stat`

Expected: 只有 Mermaid 预览相关源代码、测试和计划/规格文档变化；`.superpowers/` 等临时可视化文件不进入提交。

- [ ] **Step 2: 运行发布质量检查**

Run: `npm run check:artifacts && npm run verify:release`

Expected: 构建产物结构和发布校验通过。

- [ ] **Step 3: 记录用户验收路径**

浏览器：打开本地 Markdown → 找到 Mermaid → 点击预览 → 普通滚轮上下 → Shift + 滚轮横向 → 靠近底部验证工具栏 → 点击适应/100%/+/- → 点击遮罩关闭。

VS Code：使用最新构建打开同一 Markdown，重复上述流程并确认浅色/深色主题、滚动条和首次打开定位。

- [ ] **Step 4: Commit（仅在全部验证通过后）**

```bash
git status --short
git log -5 --oneline
```

Expected: 工作区干净，向用户报告实际运行过的命令和结果；若出现环境限制，明确标注未完成的真实浏览器验收项。
