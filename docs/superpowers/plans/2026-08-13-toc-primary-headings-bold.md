# 目录主标题与大标题加粗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让目录中的 H1 文档主标题和 H2 一级章节使用加粗字重，同时保持其他目录交互和层级缩进不变。

**Architecture:** `TOCItem` 根据已有的 `item.level` 为 H1/H2 目录链接增加统一的 `feishu-toc__link--major` 类；`layout.css` 只为该类声明加粗字重。通过 `TOCItem` 单元测试验证层级类，保留现有目录导航和折叠测试作为回归保护。

**Tech Stack:** React 18、TypeScript、Vitest、Testing Library、CSS。

## Global Constraints

- `H1` 和 `H2` 目录项加粗；`H3-H6` 保持普通字重。
- 不改变目录点击定位、折叠/展开、当前项高亮、键盘操作和缩进计算。
- 不新增依赖，不修改 Markdown 内容解析和标题 ID 生成。
- 完成后必须通过目录聚焦测试、类型检查、构建和 `git diff --check`。

---

### Task 1：为目录层级增加失败测试

**Files:** `tests/unit/TOCItem.test.tsx`（修改），参考 `src/viewer/components/TOC/TOCItem.tsx`。

- [ ] **Step 1: 写失败测试**

增加断言：`level: 1` 和 `level: 2` 的链接具有 `feishu-toc__link--major`，`level: 3` 的链接不具有该类。

- [ ] **Step 2: 运行测试确认失败**

运行 `TMPDIR=/tmp npm test -- --run tests/unit/TOCItem.test.tsx`，预期新增断言失败，因为当前组件没有输出层级类。

---

### Task 2：实现目录层级类和样式

**Files:** `src/viewer/components/TOC/TOCItem.tsx`（修改）、`src/viewer/styles/layout.css`（修改）、`tests/unit/TOCItem.test.tsx`（测试）。

- [ ] **Step 1: 增加最小实现**

在 `TOCItem` 中计算 `const isMajorHeading = item.level === 1 || item.level === 2`，仅在该值为真时为链接增加 `feishu-toc__link--major`。

在 `.feishu-toc__link` 样式后增加：

```css
.feishu-toc__link--major {
  font-weight: 600;
}
```

- [ ] **Step 2: 运行目录测试确认通过**

运行 `TMPDIR=/tmp npm test -- --run tests/unit/TOCItem.test.tsx tests/unit/TableOfContents.test.tsx`，预期层级断言、导航和折叠测试全部通过。

---

### Task 3：整体验证和提交

**Files:** 验证 `TOCItem.tsx`、`layout.css`、`TOCItem.test.tsx` 及本计划文件。

- [ ] **Step 1: 运行完整测试**：`TMPDIR=/tmp npm test`。
- [ ] **Step 2: 运行类型检查和构建**：`npm run typecheck`、`npm run build`。
- [ ] **Step 3: 检查差异**：`git diff --check`、`git status --short`，确认没有无关变更。
- [ ] **Step 4: 提交实现**：使用提交信息 `feat: emphasize primary headings in table of contents`。
