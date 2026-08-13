# 彻底预览版性能优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除编辑能力及其构建依赖，将扩展固定为高性能只读 Markdown 预览，同时保留目录、表格、Mermaid、图片和主题等阅读功能。

**Architecture:** 以 `App` 和 `TopBar` 为预览唯一入口，删除编辑模式分支和保存入口；收缩 store 与文件访问 hook，使运行时只维护阅读需要的状态；移除 Milkdown、源码编辑器、Mermaid 编辑器及编辑样式依赖。通过构建产物扫描和全量测试验证编辑代码不再进入生产入口。

**Tech Stack:** React 18、TypeScript、Zustand、Vite/CRXJS、Vitest、Markdown unified 管线、Mermaid。

## Global Constraints

- 页面始终为阅读态，不提供编辑、源码编辑、Mermaid 编辑、自动保存和文件写回。
- 保留 Markdown、目录、表格文字/区域复制、代码复制、Mermaid 图表预览/导出、图片预览、主题、字号和阅读进度。
- 旧 `mode: edit/source` 状态启动后必须归一化为 `read`。
- 不改变 Markdown 解析结果、标题 ID、目录定位和现有阅读态视觉。
- 不新增依赖；移除仅供编辑使用的依赖和生产入口引用。
- 每个任务先写失败测试并确认失败，再写最小实现。

---

### Task 1：预览入口和顶部栏

**Files:** `src/viewer/App.tsx`、`src/viewer/components/Layout/TopBar.tsx`、`tests/unit/preview-only-app.test.tsx`（新建）。

- [ ] 写失败测试：渲染 App 后不存在编辑、源码、保存控件，且编辑器组件不会渲染。
- [ ] 运行 `TMPDIR=/tmp npm test -- --run tests/unit/preview-only-app.test.tsx`，确认因当前入口仍存在编辑分支而失败。
- [ ] 删除 App 中编辑器 lazy import、编辑/源码分支、双击切换、保存状态和编辑快捷键，固定渲染 `MarkdownReadView`。
- [ ] 删除 TopBar 中编辑/源码模式按钮和保存控件，保留侧栏、主题、字号和阅读相关操作。
- [ ] 运行 `TMPDIR=/tmp npm test -- --run tests/unit/preview-only-app.test.tsx tests/unit/preview-lock-mode.test.ts tests/unit/markdown-pipeline.test.ts`。

### Task 2：只读状态与文件写回清理

**Files:** `src/viewer/store/index.ts`、`src/viewer/hooks/useFileAccess.ts`、`src/viewer/hooks/useAutoSave.ts`、`src/viewer/hooks/useBeforeUnload.ts`、`src/viewer/hooks/useModeScrollRestore.ts`、相关测试。

- [ ] 写失败测试：旧 `mode: edit/source` 启动后为 `read`，预览启动不调用自动保存和文件写回。
- [ ] 运行对应 store/App 测试确认失败。
- [ ] 删除或收缩编辑模式、脏状态、文件句柄、自动保存、写回 action 和编辑滚动恢复；读取旧持久化数据时统一为 `read`。
- [ ] 运行 store、文件访问和预览入口回归测试，确认阅读状态和设置加载不受影响。

### Task 3：移除编辑器依赖与入口

**Files:** `src/viewer/viewer-entry.tsx`、`package.json`、`pnpm-lock.yaml`、Milkdown 编辑组件、源码编辑器、编辑器专用 CSS、编辑专用测试。

- [ ] 用 `rg` 建立 `WysiwygEditor`、`SourceModeEditor`、`Milkdown`、`ProseMirror`、`CodeLanguageSelector`、`CalloutTypeSelector` 和编辑样式的引用清单。
- [ ] 写失败的构建产物检查，确认当前产物仍包含编辑器入口或依赖标记。
- [ ] 移除 viewer-entry 中编辑 CSS 注入，删除仅供编辑的组件、样式和依赖，同步 pnpm lockfile。
- [ ] 删除仅验证编辑器的测试，保留 Markdown、目录、表格、图片、主题和 Mermaid 阅读测试。
- [ ] 运行 `npm run build` 和 `npm run perf:bundle`，确认构建成功且产物不再包含编辑器入口。

### Task 4：保留 Mermaid 阅读，删除 Mermaid 编辑

**Files:** `src/viewer/components/Mermaid/MermaidToolbar.tsx`、`src/viewer/components/Mermaid/MermaidBlock.tsx`、`src/viewer/components/Mermaid/MermaidEditor.tsx`、Mermaid/编辑样式、Mermaid 测试。

- [ ] 写失败测试：阅读态仍提供预览/缩放/导出，且编辑按钮和 Mermaid 编辑器弹窗不存在。
- [ ] 运行 Mermaid 聚焦测试确认失败。
- [ ] 移除 Mermaid 编辑器 import、打开状态、编辑按钮和 store 编辑模式依赖；保留 SVG 预览、复制/导出、缩放、拖拽和错误降级。
- [ ] 运行 MermaidToolbar、MermaidPreviewModal、mermaid-svg 测试。

### Task 5：全量验证与性能验收

**Files:** 所有本次实现文件、测试文件和构建产物；仅在必要时调整性能报告脚本。

- [ ] 记录改造前后 `dist` 总体积、最大 chunk 和入口 chunk。
- [ ] 运行 `TMPDIR=/tmp npm test`。
- [ ] 运行 `npm run typecheck`、`npm run build`、`npm run perf:bundle`。
- [ ] 扫描 `dist`、`package.json` 和 `src`，确认没有生产入口引用 `WysiwygEditor`、`SourceModeEditor`、Milkdown、ProseMirror、CodeMirror 或 `MermaidEditor`。
- [ ] 运行 `git diff --check` 和 `git status --short`，确认没有无关变更。
- [ ] 手动加载最新 `dist`，验证本地/GitHub Markdown 直接进入阅读态，顶部无编辑/源码/保存入口，双击不进入编辑，目录、表格复制、Mermaid 预览/导出、图片预览和主题仍正常。
- [ ] 提交实现，提交信息使用 `feat: optimize viewer for preview-only mode`。
