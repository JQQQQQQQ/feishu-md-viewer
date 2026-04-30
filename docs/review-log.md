# Review Log - Feishu MD Viewer

> 本文档记录每个 Phase 的审核迭代过程，包括 Review Agent 的审核结果、发现的问题、修复要求和修复结果。

---

## Phase 1 - Iteration 1

- **日期**: 2026-04-30
- **判定**: FAIL (1 issue)
- **通过门禁**: TypeScript strict, ESLint, Build, ARIA landmarks, No eval
- **未通过门禁**: Security (unsanitized dangerouslySetInnerHTML)
- **问题**:
  1. [Major] `src/viewer/components/Markdown/MermaidBlock.tsx:63` — `dangerouslySetInnerHTML` 使用了未经 DOMPurify 净化的 Mermaid SVG 输出
- **修复要求**:
  1. 在 MermaidBlock 中对 mermaid.render() 的 SVG 输出使用 DOMPurify.sanitize() (SVG profile)
- **修复结果**: 已添加 `DOMPurify.sanitize(result, { USE_PROFILES: { svg: true, svgFilters: true } })` 净化 SVG 输出

## Phase 1 - Iteration 2

- **日期**: 2026-04-30
- **判定**: PASS
- **通过门禁**: TypeScript strict, ESLint, Build, Security (DOMPurify on all outputs), ARIA landmarks, No eval, Mermaid securityLevel strict
- **注意事项**: Bundle size 3.4MB 超过 2MB 目标，原因是 Mermaid 库体积大，计划在 Phase 6 通过动态 import 优化

---

## Phase 2 - Iteration 1

- **日期**: 2026-04-30
- **判定**: FAIL (2 issues)
- **通过门禁**: TypeScript, Build, Security, Keyboard, Responsive, Animation, No inline styles
- **未通过门禁**: ESLint (aria-selected missing), Visual completeness (TOC styles missing)
- **问题**:
  1. [Critical] `src/viewer/components/TOC/TOCItem.tsx:38` — `role="treeitem"` 缺少 `aria-selected` 属性
  2. [Critical] 所有 `.feishu-toc*` CSS 类无样式定义，TOC 视觉上完全无效
- **修复要求**:
  1. 添加 `aria-selected={isActive}` 到 `<li role="treeitem">`
  2. 在 layout.css 中添加完整 TOC 样式
- **修复结果**: 两项均已修复

## Phase 2 - Iteration 2

- **日期**: 2026-04-30
- **判定**: PASS
- **通过门禁**: TypeScript strict, ESLint, Build, Accessibility (aria-selected, aria-expanded, skip-link, aria-label), Keyboard (Escape), Responsive (<768px drawer), Animation (prefers-reduced-motion), TOC styles complete
- **测试**: 39 tests pass (16 new for Phase 2: useTOC 7 + TOCItem 9)

---

