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

---

## 单元测试清单

### Phase 1: MVP 基础渲染
- [x] `tests/unit/markdown-pipeline.test.ts` — MD 管线 AST 输出验证 (8 tests)
- [x] `tests/unit/mermaid-init.test.ts` — Mermaid 配置验证 (2 tests)
- [x] `tests/unit/detector.test.ts` — URL 匹配规则验证 (6 tests)
- [ ] `tests/unit/FeishuComponents.test.tsx` — 自定义组件快照测试 (deferred)
- [x] `tests/unit/sanitization.test.ts` — DOMPurify XSS 防护验证 (7 tests)

### Phase 2: 导航与布局
- [x] `tests/unit/useTOC.test.ts` — 标题提取逻辑 (7 tests)
- [x] `tests/unit/TOCItem.test.tsx` — 目录项交互 (9 tests)

### Phase 3: 文档编辑
- [x] `tests/unit/store.test.ts` — Zustand store 状态管理 (10 tests)
- [x] `tests/unit/mermaid-writeback.test.ts` — 代码块替换逻辑 (5 tests)
- [x] `tests/unit/xss-prevention.test.ts` — XSS 向量测试 (3 tests)

### Phase 4: 文件保存
- [ ] `tests/unit/useFileAccess.test.ts` — File System Access API mock
- [ ] `tests/unit/useAutoSave.test.ts` — 自动保存防抖
- [ ] `tests/unit/indexeddb-persistence.test.ts` — 句柄持久化

### Phase 5: 多平台适配
- [ ] `tests/unit/github-adapter.test.ts` — GitHub 内容提取
- [ ] `tests/unit/gitlab-adapter.test.ts` — GitLab 内容提取
- [ ] `tests/unit/service-worker.test.ts` — 消息路由

### Phase 6: 打磨与发布
- [ ] `tests/unit/theme-switching.test.ts` — 主题切换
- [ ] `tests/unit/katex-integration.test.ts` — 公式渲染
- [ ] `tests/unit/export-mermaid.test.ts` — 导出功能

---

## 集成测试清单

### Phase 2
- [ ] `tests/integration/toc-scroll.integration.test.tsx` — TOC 与文档滚动联动

### Phase 3
- [ ] `tests/integration/editor-preview-sync.test.tsx` — 编辑器与预览同步
- [ ] `tests/integration/mermaid-editor-lifecycle.test.tsx` — Mermaid 编辑全生命周期

### Phase 4
- [ ] `tests/integration/file-save-lifecycle.test.ts` — 编辑 → 自动保存 → 文件写入

### Phase 5
- [ ] `tests/integration/platform-adapter.test.ts` — 多平台适配器统一接口

---

## E2E 手动验证清单

> 以下用例在真实浏览器中手动执行，加载未打包扩展后验证。

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

> 每次测试执行后更新

_(待执行)_
