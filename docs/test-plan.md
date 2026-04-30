# Test Plan - Feishu MD Viewer

## 概览

- **框架**: Vitest (单元 + 集成)
- **覆盖率工具**: Istanbul via Vitest
- **E2E**: 手动验证 checklist (Playwright 配置备用)
- **覆盖率目标**: >= 80% lines / >= 75% branches / >= 85% functions

---

## 测试结果汇总

| 日期 | Phase | Pass | Fail | 行覆盖率 | 分支覆盖率 |
|------|-------|------|------|----------|-----------|
| 2026-04-30 | Phase 1 | 23 | 0 | - | - |
| 2026-04-30 | Phase 2 | 39 (cumulative) | 0 | - | - |
| 2026-04-30 | Phase 3 | 57 (cumulative) | 0 | - | - |
| 2026-04-30 | Phase 4 | 73 (cumulative) | 0 | - | - |
| 2026-04-30 | Phase 5 | 114 (cumulative) | 0 | - | - |
| 2026-04-30 | Phase 6 | 139 (cumulative) | 0 | - | - |

---

## 单元测试清单

### Phase 1: MVP 基础渲染
- [x] `tests/unit/markdown-pipeline.test.ts` — MD 管线 AST 输出验证 (8 tests)
- [x] `tests/unit/mermaid-init.test.ts` — Mermaid 配置验证 (2 tests)
- [x] `tests/unit/detector.test.ts` — URL 匹配规则验证 (6 tests)
- [~] `tests/unit/FeishuComponents.test.tsx` — 自定义组件快照测试 (deferred: 组件逻辑由 markdown-pipeline.test.ts 间接覆盖)
- [x] `tests/unit/sanitization.test.ts` — DOMPurify XSS 防护验证 (7 tests)

### Phase 2: 导航与布局
- [x] `tests/unit/useTOC.test.ts` — 标题提取逻辑 (7 tests)
- [x] `tests/unit/TOCItem.test.tsx` — 目录项交互 (9 tests)

### Phase 3: 文档编辑
- [x] `tests/unit/store.test.ts` — Zustand store 状态管理 (10 tests)
- [x] `tests/unit/mermaid-writeback.test.ts` — 代码块替换逻辑 (5 tests)
- [x] `tests/unit/xss-prevention.test.ts` — XSS 向量测试 (3 tests)

### Phase 4: 文件保存
- [x] `tests/unit/useFileAccess.test.ts` — File System Access API mock (7 tests)
- [x] `tests/unit/useAutoSave.test.ts` — 自动保存防抖 (5 tests)
- [x] `tests/unit/indexeddb-persistence.test.ts` — 句柄持久化 (4 tests)

### Phase 5: 多平台适配
- [x] `tests/unit/github-adapter.test.ts` — GitHub adapter detect/title (11 tests)
- [x] `tests/unit/gitlab-adapter.test.ts` — GitLab adapter detect/title (11 tests)
- [x] `tests/unit/service-worker.test.ts` — URL validation allowlist (19 tests)

### Phase 6: 打磨与发布
- [x] `tests/unit/theme-switching.test.ts` — 主题切换 + 字体大小 (13 tests)
- [x] `tests/unit/export-mermaid.test.ts` — SVG/PNG 导出 (7 tests)
- [x] `tests/unit/copy-button.test.ts` — 代码复制按钮 (5 tests)
- [~] `tests/unit/katex-integration.test.ts` — 公式渲染 (deferred: KaTeX 未在 Phase 6 实装，列入后续迭代)

---

## 集成测试清单

> 以下集成测试因涉及浏览器 API (IntersectionObserver, File System Access, Chrome Extension API 等) 在 jsdom 环境下无法完全模拟，由对应的单元测试间接覆盖核心逻辑。标注为"单测覆盖"的项不再单独创建集成测试文件。

### Phase 2
- [x] TOC 与文档滚动联动 — 由 `useTOC.test.ts` + `TOCItem.test.tsx` 覆盖核心逻辑 (IntersectionObserver 需真实浏览器验证)

### Phase 3
- [x] 编辑器与预览同步 — 由 `store.test.ts` (setContent/undo/redo) + `xss-prevention.test.ts` 覆盖
- [x] Mermaid 编辑全生命周期 — 由 `mermaid-writeback.test.ts` 覆盖代码块替换逻辑

### Phase 4
- [x] 编辑 → 自动保存 → 文件写入 — 由 `useAutoSave.test.ts` + `useFileAccess.test.ts` + `indexeddb-persistence.test.ts` 覆盖

### Phase 5
- [x] 多平台适配器统一接口 — 由 `github-adapter.test.ts` + `gitlab-adapter.test.ts` + `service-worker.test.ts` 覆盖

---

## E2E 手动验证清单

> 以下用例需在真实 Chrome 浏览器中手动执行（加载 `dist/` 目录为未打包扩展）。
> 状态说明：`[ ]` = 待验收 (需人工在浏览器中确认)，这些不属于自动化测试范畴。

### Phase 1: 基础渲染
- [ ] 打开 `file:///path/to/test.md` → 看到飞书风格渲染
- [ ] 标题 (H1-H6) 样式正确，H1 有底线
- [ ] 代码块有语法高亮 + 语言标签 + 圆角
- [ ] 表格有斑马条纹 + 圆角外框
- [ ] 引用块有蓝色左边条 + 浅蓝背景
- [ ] Mermaid 代码块渲染为 SVG 图表
- [ ] 无效 Mermaid 语法显示错误提示而非崩溃
- [ ] 控制台无报错

### Phase 2: 导航
- [ ] 左侧目录正确生成所有标题
- [ ] 点击目录项平滑滚动到对应标题
- [ ] 滚动文档时目录高亮跟随
- [ ] 侧边栏可折叠/展开
- [ ] 窄屏 (<768px) 侧边栏变为抽屉

### Phase 3: 编辑
- [ ] 点击编辑按钮切换到编辑模式
- [ ] 编辑 Markdown 文本，预览实时更新
- [ ] 编辑 Mermaid 代码，图表实时更新
- [ ] Cmd+Z 撤销 / Cmd+Shift+Z 重做正常
- [ ] 输入 `<script>alert(1)</script>` 被安全转义

### Phase 4: 保存
- [ ] 首次保存弹出文件选择器
- [ ] 后续保存静默执行
- [ ] 2s 无操作自动保存
- [ ] 状态指示器正确显示 已保存/保存中/未保存
- [ ] 关闭有未保存内容的标签显示确认弹窗

### Phase 5: 多平台
- [ ] GitHub 上 .md 文件被扩展接管渲染
- [ ] GitLab 上 .md 文件被扩展接管渲染
- [ ] 右键菜单 "Open in Feishu Viewer" 可用
- [ ] 网络失败显示友好错误页

### Phase 6: 打磨
- [ ] 暗色主题切换正常
- [ ] 字体大小调整持久化
- [ ] Mermaid 导出 SVG/PNG 成功
- [ ] 代码块复制按钮可用
- [ ] LaTeX 公式正确渲染
- [ ] 打印预览干净可读

---

## 覆盖率报告

### 最终统计 (2026-04-30)

| 指标 | 数值 |
|------|------|
| 测试文件 | 18 |
| 测试用例 | 139 |
| 通过 | 139 (100%) |
| 失败 | 0 |
| 执行时间 | ~4s |

### 按模块覆盖

| 模块 | 测试文件 | 测试数 |
|------|----------|--------|
| Content/Detector | detector.test.ts | 6 |
| Markdown Pipeline | markdown-pipeline.test.ts | 8 |
| Mermaid Init | mermaid-init.test.ts | 2 |
| Sanitization | sanitization.test.ts | 7 |
| XSS Prevention | xss-prevention.test.ts | 3 |
| TOC Hook | useTOC.test.ts | 7 |
| TOC Component | TOCItem.test.tsx | 9 |
| Store | store.test.ts | 10 |
| Mermaid Writeback | mermaid-writeback.test.ts | 5 |
| File Access | useFileAccess.test.ts | 7 |
| Auto Save | useAutoSave.test.ts | 5 |
| IndexedDB | indexeddb-persistence.test.ts | 4 |
| GitHub Adapter | github-adapter.test.ts | 11 |
| GitLab Adapter | gitlab-adapter.test.ts | 11 |
| URL Validation | service-worker.test.ts | 19 |
| Theme/Font | theme-switching.test.ts | 13 |
| Mermaid Export | export-mermaid.test.ts | 7 |
| Copy Button | copy-button.test.ts | 5 |

### 未覆盖项 (已知 gap)

| 项 | 原因 | 计划 |
|----|------|------|
| FeishuComponents 快照测试 | 组件渲染逻辑由 pipeline 测试间接覆盖 | 后续迭代补充 |
| KaTeX 集成测试 | KaTeX 功能未在当前版本实装 | 下一版本实装时补充 |
| IntersectionObserver 集成 | jsdom 不支持, 由 E2E 手动验证覆盖 | 浏览器手动验收 |
| File System Access API 集成 | 需真实浏览器环境 | 浏览器手动验收 |
