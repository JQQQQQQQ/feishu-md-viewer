# 表格原生文本选择与 Excel 框选共存实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development while implementing this plan.

**目标：** 在保留 Excel 式多单元格框选和 TSV/HTML 复制的同时，允许用户直接拖选单元格内部的一部分文字并复制。

**方案：** 将表格指针交互分为文字选择、单元格框选、列宽调整和交互元素四种意图。文字命中时完全交给浏览器原生 Selection；空白区域继续由 `FeishuTable` 管理矩形单元格选择。复制事件按“原生文字选区优先、单元格框选其次”分派。

**技术栈：** React 18、TypeScript、Vitest、DOM Selection/Clipboard API。

## 全局约束

- 不改变现有表格列宽持久化、sticky 表头、宽表格布局和单元格框选数据格式。
- 单元格文字、链接、行内代码必须支持部分文本选择。
- 单元格空白区域拖动仍保持 Excel 式多单元格选择。
- 表格内原生文字选区存在时，表格不得拦截浏览器复制事件。
- 兼容 ShadowRoot；不得依赖全局 `document.activeElement` 判断表格焦点。
- 不新增 Markdown 长期状态，不提交 Git。

---

### Task 1：抽离指针意图与原生选择判断

**文件：**

- 新建：`src/viewer/components/Markdown/table-pointer-intent.ts`
- 新建：`src/viewer/components/Markdown/table-native-selection.ts`
- 测试：`tests/unit/table-pointer-intent.test.ts`
- 测试：`tests/unit/table-native-selection.test.ts`

**接口：**

```ts
export type TablePointerIntent = 'text' | 'cell-range' | 'column-resize' | 'interactive';
export function resolveTablePointerIntent(event: MouseEvent, wrapper: HTMLElement, cell: HTMLTableCellElement): TablePointerIntent;
export function hasNativeTextSelection(wrapper: HTMLElement): boolean;
```

- [ ] 写失败测试：文字节点返回 `text`，链接/按钮返回 `interactive`，列边缘由调用方传入边缘判断后返回 `column-resize`，cell padding 返回 `cell-range`。
- [ ] 运行 `TMPDIR=/tmp npm test -- --run tests/unit/table-pointer-intent.test.ts tests/unit/table-native-selection.test.ts`，确认因新接口不存在而失败。
- [ ] 实现命中逻辑：优先排除交互元素，再用 `caretRangeFromPoint`/`caretPositionFromPoint` 判断文字插入点，并限制结果必须属于 wrapper。
- [ ] 实现 Selection 判断：非折叠、有文本、anchor/focus 均属于 wrapper；支持 Document 与 ShadowRoot。
- [ ] 重跑两个测试文件，确认通过。

### Task 2：接入 FeishuTable 的双模式指针交互

**文件：**

- 修改：`src/viewer/components/Markdown/FeishuTable.tsx`
- 测试：`tests/unit/FeishuTable.test.tsx`

**接口：** 使用 Task 1 的 `TablePointerIntent` 与 `hasNativeTextSelection`。

- [ ] 先补失败测试：文字 `mousedown` 不调用 `preventDefault`、不清空原生 Selection；空白 cell 仍建立框选；列宽边缘仍进入 resize；链接/按钮不启动框选。
- [ ] 运行 `TMPDIR=/tmp npm test -- --run tests/unit/FeishuTable.test.tsx`，确认新增测试失败。
- [ ] 在 `handleMouseDown` 中先判断 resize 和 pointer intent；`text`/`interactive` 直接返回，`cell-range` 才执行现有 `preventDefault`、清 Selection、focus 和 applySelection。
- [ ] 保持 `handleMouseOver`、document mousemove/mouseup 和列宽逻辑不变，仅将模式入口统一到 cell-range。
- [ ] 重跑 `FeishuTable.test.tsx`，确认既有多行/同一行拖选仍通过。

### Task 3：调整复制优先级与清理边界

**文件：**

- 修改：`src/viewer/components/Markdown/FeishuTable.tsx`
- 测试：`tests/unit/FeishuTable.test.tsx`
- 测试：`tests/unit/table-native-selection.test.ts`

- [ ] 先补失败测试：表格内部分文字 Selection 存在时，`copy` 不调用 `preventDefault`；单元格框选时仍写入 TSV/HTML；`Ctrl/Cmd+C` 不覆盖原生文字。
- [ ] 运行上述测试确认失败。
- [ ] 在 document `copy` 和 `keydown` 复制分支中先调用 `hasNativeTextSelection(wrapper)`；若为真直接返回；只有存在 `selectionRef`/`copiedRef` 时才接管表格复制。
- [ ] 点击表格外仍清理 cell range，但不得清理表格外的原生 Selection；Escape 仅清理 cell range。
- [ ] 重跑聚焦测试，确认复制优先级通过。

### Task 4：整合回归与验收

**文件：**

- 可能修改：`src/viewer/styles/markdown.css`（仅在现有 `user-select` 规则阻断文字选择时调整）
- 测试：`tests/unit/FeishuTable.test.tsx`
- 测试：`tests/unit/table-pointer-intent.test.ts`
- 测试：`tests/unit/table-native-selection.test.ts`

- [ ] 增加链接、行内代码、ShadowRoot Selection 和列宽边缘回归。
- [ ] 运行 `TMPDIR=/tmp npm test -- --run tests/unit/FeishuTable.test.tsx tests/unit/table-pointer-intent.test.ts tests/unit/table-native-selection.test.ts`。
- [ ] 运行全量 `TMPDIR=/tmp npm test`。
- [ ] 运行 `npm run typecheck`、`npm run build`、`git diff --check`。
- [ ] 检查 `git status --short`，保留未提交修改，不执行 commit/push。
