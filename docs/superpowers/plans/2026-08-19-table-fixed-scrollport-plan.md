# 固定表格滚动视口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 固定原生横向滚动条宽度，并在初始横向滚动阶段展示左侧内容。

**Architecture:** 将当前单一表格滚动容器拆为固定原生滚动视口和左侧展示层。外框、正文和滚动条宽度不随滚动改变。

**Tech Stack:** React 18、TypeScript、Vitest、CSS Variables。

**Spec:** `docs/superpowers/specs/2026-08-19-table-fixed-scrollport-design.md`

## Task 1: 滚动派生状态

**Files:** `src/viewer/components/Markdown/FeishuTableLayout.ts`、`tests/unit/FeishuTableLayout.test.ts`

- [ ] 先写失败测试：`resolveTableScrollPresentation(10, 200, 1366)` 返回 `{ leftReveal: 10, mainScrollLeft: 0 }`，超过左侧上限时将余量放入 `mainScrollLeft`。
- [ ] 运行 `TMPDIR=/tmp npm test -- --run tests/unit/FeishuTableLayout.test.ts`，确认 RED。
- [ ] 实现 `resolveTableScrollPresentation(scrollLeft, tableLeft, viewportWidth)`，其中 `leftReveal = min(scrollLeft, tableLeft - viewportWidth * 0.1)`。
- [ ] 再运行同一测试确认 GREEN。

## Task 2: 固定原生滚动视口

**Files:** `src/viewer/components/Markdown/FeishuTable.tsx`、`src/viewer/styles/markdown.css`、`tests/unit/FeishuTable.test.tsx`

- [ ] 先写失败测试，断言存在 `.feishu-table__scrollport` 和 `.feishu-table__left-reveal`。
- [ ] 运行 `TMPDIR=/tmp npm test -- --run tests/unit/FeishuTable.test.tsx`，确认 RED。
- [ ] 新增固定宽度的 `.feishu-table__scrollport` 作为唯一 `overflow-x:auto` 容器；新增只读、裁剪的 `.feishu-table__left-reveal`，它位于主视口左侧。
- [ ] 删除当前自定义滚动条、内容 transform 与外框扩宽补偿代码。
- [ ] 运行同一测试确认 GREEN。

## Task 3: 同步、回收与回归

**Files:** `src/viewer/components/Markdown/FeishuTable.tsx`、`src/viewer/styles/markdown.css`、`tests/unit/FeishuTable.test.tsx`、`tests/unit/markdown-table-sticky-header.test.ts`

- [ ] 先写失败测试：滚动 10px 时 `--feishu-table-left-reveal` 为 `10px`，固定滚动视口宽度不变。
- [ ] 运行 `TMPDIR=/tmp npm test -- --run tests/unit/FeishuTable.test.tsx tests/unit/markdown-table-sticky-header.test.ts`，确认 RED。
- [ ] 在 scrollport 的 scroll 事件中使用 `resolveTableScrollPresentation` 更新展示层宽度、固定表头偏移和目录事件；不再改外框宽度或正文边距。
- [ ] 当表格不再溢出、用户回滚或缩窄列宽时，清零展示层。
- [ ] 运行 `TMPDIR=/tmp npm test -- --run tests/unit/FeishuTable.test.tsx tests/unit/FeishuTableLayout.test.ts tests/unit/markdown-table-sticky-header.test.ts`，确认 GREEN。

## Task 4: 最终验证

- [ ] 运行 `TMPDIR=/tmp npm test && npm run typecheck && npm run build && git diff --check`。
- [ ] 在扩展中手动验证窄表、宽表、10px 左侧展示、左侧上限、回滚、缩窄、固定表头、文字选择、行列选择和复制。
