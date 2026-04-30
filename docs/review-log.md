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

## Phase 3 - Iteration 1

- **日期**: 2026-04-30
- **判定**: FAIL (1 issue)
- **通过门禁**: TypeScript, Build, Tests (39 pass), Security, Undo/Redo, Mode toggle, XSS, Keyboard shortcuts
- **未通过门禁**: ESLint (2 errors in SplitPane.tsx — jsx-a11y false positives on role="separator")
- **问题**:
  1. [Major] `src/viewer/components/Common/SplitPane.tsx:67,73` — role="separator" 缺少 onKeyDown 且 jsx-a11y 不认为 separator 是交互角色
  2. [Important] `src/viewer/components/Markdown/MarkdownEditor.tsx` — debounce timer 在外部 content 变化时未清除
- **修复要求**:
  1. 添加 ArrowLeft/Right 键盘调整 + eslint-disable 注释
  2. 在 content useEffect 中 clearTimeout
- **修复结果**: 两项均已修复，ESLint 零错误

## Phase 3 - Iteration 2

- **日期**: 2026-04-30
- **判定**: PASS
- **通过门禁**: TypeScript strict, ESLint, Build, Security (no dangerouslySetInnerHTML in editors, DOMPurify pipeline intact), Undo/Redo (50 cap), Mode toggle, XSS prevention, Keyboard (Cmd+Z/Shift+Z, Arrow keys on separator)
- **测试**: 57 tests pass (18 new for Phase 3: store 10 + mermaid-writeback 5 + xss-prevention 3)

---

## Phase 4 - Iteration 1

- **日期**: 2026-04-30
- **判定**: PASS (首次即通过)
- **通过门禁**: TypeScript strict, ESLint, Build, Existing tests (57), Error handling (permission/disk/lock), Download fallback, Auto-save (2s debounce), beforeunload guard, Keyboard (Cmd+S), IndexedDB persistence
- **安全审查**: 无 eval, IndexedDB 仅存 FileSystemFileHandle (非敏感数据), 所有错误 try/catch 覆盖
- **测试**: 73 tests pass (16 new: useFileAccess 7 + useAutoSave 5 + indexeddb 4)

---

## Phase 5 - Iteration 1

- **日期**: 2026-04-30
- **判定**: PASS (首次即通过)
- **通过门禁**: TypeScript strict, ESLint, Build, All tests (73), URL validation (allowlist), CORS (extension context), Error handling (rate limit/network), Adapter pattern, Context menu
- **安全审查**: URL allowlist 在 service-worker 和 viewer-entry 双重验证, Content-Type 校验防止 HTML 注入, 无 eval
- **改进建议** (非阻塞):
  1. GitLab 适配器暂不支持嵌套 group (gitlab.com/org/subgroup/repo)
  2. content/index.tsx 中 adapter.getContent() 缺少 try/catch
  3. detector.ts 为遗留代码，可后续清理
- **测试**: 114 tests pass (41 new: github-adapter 11 + gitlab-adapter 11 + url-validation 19)

---

