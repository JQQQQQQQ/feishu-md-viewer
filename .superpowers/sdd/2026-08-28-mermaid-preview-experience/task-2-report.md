# Task 2：B2 工具栏和 F1 关闭行为

## 实现结果

- 在 `MermaidPreviewModal` 内新增工具栏显隐状态，以及 180ms 的延迟隐藏计时器。
- 底部热区、工具栏自身的 pointer 进入会显示工具栏；离开后延迟隐藏；工具栏获得焦点或键盘操作也会保持显示。
- 工具栏与热区改为 dialog 内的绝对定位浮层，不参与 canvas 的 flex 布局，也不改变 canvas 的子结构、布局或滚动宽度。
- overlay 仅在点击自身背景时调用 `onClose`；canvas、dialog 和工具栏内部点击不会关闭。
- Escape 在 window 捕获阶段关闭预览，并阻止事件继续传播到正文快捷键处理器。
- 模态关闭后焦点仍由现有 `MermaidToolbar` 的下一帧回调恢复到“预览”按钮。
- 保留 `prefers-reduced-motion` 分支，并为工具栏关闭过渡动画。

## 修改文件

- `src/viewer/components/Mermaid/MermaidPreviewModal.tsx`
- `src/viewer/styles/mermaid.css`

未修改 Task 1 提交的测试契约。

## 验证记录

1. RED 基线：

   ```bash
   TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx
   ```

   修改前共 3 个失败：B2 工具栏初始隐藏、C2 空格平移、F1 overlay 点击关闭。

2. B2/F1 定向验证：

   ```bash
   TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx -t '默认隐藏底部工具栏|canvas、dialog 和 toolbar 点击不关闭'
   ```

   结果：2 passed，4 skipped。B2 和 F1 均为 GREEN。

3. 全部预览单元契约：

   ```bash
   TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx
   ```

   结果：5 passed，1 failed。唯一失败为 C2“只在按住空格时进入画布平移状态”，符合本任务明确要求保留 C2 RED 的范围。

4. 构建与静态检查：

   ```bash
   npm run build
   git diff --check
   ```

   结果：构建成功（`tsc --noEmit` 和 `vite build` 均通过），`git diff --check` 无输出。

## 自审

- 工具栏状态 class 只切换在 canvas 外的浮层元素，canvas 的 DOM 子结构、class、inline style 与 content 尺寸在显隐前后不变。
- overlay 的 target/currentTarget 判断保证内部交互不会误关闭；Escape 的捕获监听与 `preventDefault`/`stopPropagation` 防止正文快捷键继续响应。
- 计时器在重新显示和组件卸载时均清理，避免已关闭预览的异步状态更新。
- 导出功能保持在正文 `MermaidToolbar`，本任务没有移动或修改导出入口。

## Concerns

- 全量预览单元文件仍有 C2 的 1 个预期 RED，必须由后续 Task 3 实现空格平移后再追求整文件全绿。
- B2 测试输出包含 React `act(...)` 警告：它由测试在未使用 `act` 的情况下推进假计时器触发，断言本身已通过；本任务遵循“不要修改 Task 1 测试”的限制，未改动该测试。
- `npm run build` 保留项目既有的 Rollup 大 chunk 警告，未造成构建失败，与本次改动无关。

## Task 2 review 修正（不纳入修正 commit）

### 修复内容

- 新增 toolbar 的 focus-within 状态与 hot area/toolbar pointer 状态。toolbar 或其按钮已由用户聚焦时，pointerLeave 不会安排隐藏；焦点移到 toolbar 外且指针也不在两个触发区域后，才开始 180ms 延迟隐藏。
- `scheduleToolbarHide()` 的 timer 回调会再次确认焦点和指针状态，避免 timer 已排队后发生 focusin/pointerenter 时误隐藏。
- 新增 `cancelDrag()` 与 `cleanupPreviewInteraction()`；Escape、关闭按钮与 overlay 关闭均会先释放 active pointer capture、置空 `dragStateRef`、重置 dragging state、清理 toolbar timer。组件卸载也会释放 capture/清空 drag state，避免依赖浏览器的隐式 DOM 回收。
- 新增独立回归测试 `tests/unit/mermaid-preview-task2-review.test.tsx`，没有修改 Task 1 的 `mermaid-preview-only.test.tsx` 契约。

### 初始焦点裁定（ledger）

- 保留模态打开后 rAF 聚焦“关闭预览”按钮：这保证键盘用户进入 modal 后有可见、可操作的焦点目标，工具栏会因此显示。这是“默认隐藏”和“初始可访问焦点”之间的无障碍折中，不移除该焦点行为。
- 为兼容 Task 1 已提交的 B2 fake-timer 契约，程序化的初始 focus 只负责展开工具栏，不建立持续的用户 focus-within 持有；用户后续聚焦 toolbar/button 才建立该持有状态，并阻止 pointerLeave 隐藏。这样保留打开时的可访问焦点与工具栏可见性，同时不改变既有 B2 的延迟隐藏验收路径。

### 复审验证记录

1. 新增测试的 RED 基线：

   ```bash
   TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-task2-review.test.tsx
   ```

   修复前 2 个失败：焦点仍在 toolbar 时 180ms 后被隐藏；Escape 未释放 active pointer capture。

2. 新增测试 GREEN：

   ```bash
   TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-task2-review.test.tsx
   ```

   结果：2 passed。

3. 既有 Task 1 Mermaid 预览契约：

   ```bash
   TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx
   ```

   结果：5 passed，1 failed；唯一失败仍是 Task 3 范围内的 C2 空格平移契约。
