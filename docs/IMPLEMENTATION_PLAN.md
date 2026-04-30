# Feishu MD Viewer - Chrome 浏览器扩展实施计划

## Context

Chrome 浏览器扩展，用于在浏览器中以飞书文档风格阅读和编辑 Markdown + Mermaid 文件。核心需求：目录导航、Mermaid 流程图预览与编辑、文档编辑、实时保存到源文件。

---

## 技术选型

| 领域 | 选型 | 理由 |
|------|------|------|
| 构建工具 | Vite 5 + CRXJS plugin | Chrome Extension 专用 HMR，支持 MV3 |
| 框架 | React 18 + TypeScript 5 | 组件化开发，生态丰富 |
| 样式 | Tailwind CSS 3 + CSS Variables | 飞书主题变量系统 |
| MD 解析 | unified + remark + rehype + rehype-react | 管线架构，AST 可操作 |
| 代码高亮 | shiki (via rehype-shiki) | VSCode 主题兼容 |
| Mermaid | mermaid.js (render API) | 官方唯一方案 |
| Mermaid 编辑 | CodeMirror 6 | 轻量、语法高亮 |
| 状态管理 | Zustand | 无 boilerplate，适合中型应用 |
| 文件保存 | File System Access API | 浏览器原生写回本地 |
| 动画 | Framer Motion | 侧边栏折叠等过渡 |
| 图标 | Lucide React | 清爽风格匹配飞书美学 |

---

## 项目结构

```
feishu-md-viewer/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── public/
│   ├── manifest.json                 # Manifest V3
│   └── icons/
├── src/
│   ├── background/
│   │   └── service-worker.ts         # 消息路由、右键菜单、设置持久化
│   ├── content/
│   │   ├── index.tsx                 # Content Script 入口
│   │   ├── detector.ts              # 检测是否为 .md 文件
│   │   └── injector.ts              # ShadowDOM 注入 React 应用
│   ├── viewer/                       # 主渲染应用
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── Layout/              # AppShell, Sidebar, TopBar, MainContent
│   │   │   ├── TOC/                 # TableOfContents, TOCItem, useTOC
│   │   │   ├── Markdown/            # MarkdownRenderer, FeishuComponents, MarkdownEditor
│   │   │   ├── Mermaid/             # MermaidPreview, MermaidEditor, MermaidToolbar
│   │   │   └── Common/              # Button, Icon, SplitPane
│   │   ├── hooks/
│   │   │   ├── useFileAccess.ts     # File System Access API
│   │   │   ├── useMarkdownParser.ts # MD 解析
│   │   │   ├── useAutoSave.ts       # 自动保存
│   │   │   └── useScrollSync.ts     # 滚动同步
│   │   ├── store/
│   │   │   └── index.ts             # Zustand store
│   │   └── styles/
│   │       ├── feishu-theme.css     # 飞书 CSS 变量
│   │       ├── markdown.css         # MD 渲染样式
│   │       └── mermaid-override.css
│   ├── popup/                        # 扩展弹窗
│   ├── options/                      # 选项页
│   ├── shared/
│   │   ├── types/
│   │   ├── utils/
│   │   └── constants.ts
│   └── lib/
│       ├── markdown-pipeline.ts     # remark/rehype 管线
│       ├── mermaid-init.ts          # Mermaid 全局配置
│       └── feishu-rehype-plugins.ts # 自定义插件
└── tests/
```

---

## 页面布局

```
┌──────────────────────────────────────────────────────────────┐
│ TopBar: logo | 文档标题 | 阅读/编辑切换 | 保存状态 | 设置    │
├───────────┬──────────────────────────────────────────────────┤
│ Sidebar   │  MainContent                                     │
│ (TOC)     │  ┌────────────────────────────────────────────┐  │
│           │  │ MarkdownRenderer (阅读模式)                │  │
│ ▶ H1      │  │ 或 SplitView 编辑器 (编辑模式)           │  │
│   ├ H2    │  │                                            │  │
│   ├ H2    │  │ 内嵌 MermaidPreview 组件                  │  │
│ ▶ H1      │  │ (hover 显示工具栏: 编辑/导出/缩放)       │  │
│           │  └────────────────────────────────────────────┘  │
└───────────┴──────────────────────────────────────────────────┘
```

---

## 分阶段实施路线

### Phase 1: MVP - 基础渲染 (Week 1-2)

**目标**: 打开本地 .md 文件能看到飞书风格渲染 + Mermaid 图表

- [ ] 项目脚手架: Vite + CRXJS + React + TS + Tailwind
- [ ] `manifest.json` Manifest V3 配置
- [ ] Content Script: 检测 `file:///*.md` 并提取纯文本
- [ ] Markdown 解析管线: remark-parse → remark-gfm → remark-rehype → rehype-shiki → rehype-react
- [ ] `FeishuComponents.tsx`: 自定义渲染组件（标题、段落、列表、代码块、表格、引用）
- [ ] `feishu-theme.css`: 飞书核心设计变量
- [ ] `markdown.css`: 飞书风格排版
- [ ] Mermaid 代码块识别 + `mermaid.render()` SVG 注入（只读）
- [ ] 单列居中白色卡片布局

### Phase 2: 导航与布局 (Week 3)

**目标**: 完整的飞书文档阅读体验

- [ ] `useTOC` hook: 从 AST 提取标题层级
- [ ] `TableOfContents` 组件: 可折叠树形目录
- [ ] 标题锚点 + smooth scroll 跳转
- [ ] Intersection Observer: 当前阅读位置高亮
- [ ] `Sidebar` 折叠/展开 (Framer Motion 动画)
- [ ] `TopBar` 工具栏
- [ ] 响应式布局

### Phase 3: 文档编辑 (Week 4-5)

**目标**: Markdown 和 Mermaid 均可编辑

- [ ] 阅读/编辑模式切换
- [ ] Markdown 编辑器: textarea + 实时预览 split view
- [ ] Mermaid 编辑器: CodeMirror 6 + 实时预览
- [ ] Zustand store 状态管理
- [ ] Undo/Redo

### Phase 4: 文件保存 (Week 5-6)

**目标**: 实时保存到本地文件

- [ ] `useFileAccess` hook: File System Access API
- [ ] 首次保存: `showSaveFilePicker()`
- [ ] 后续保存: 复用句柄
- [ ] 自动保存 debounce 2秒
- [ ] 保存状态指示器
- [ ] IndexedDB 持久化句柄

### Phase 5: 多平台适配 (Week 7)

**目标**: GitHub/GitLab 支持

- [ ] GitHub/GitLab 页面检测 + raw content 获取
- [ ] 平台适配器模式
- [ ] 右键菜单 "在 Feishu Viewer 中打开"
- [ ] Extension Page 模式

### Phase 6: 打磨与发布 (Week 8)

- [ ] 暗色主题
- [ ] Mermaid 导出 SVG/PNG
- [ ] 代码块复制按钮
- [ ] 数学公式 (KaTeX)
- [ ] Chrome Web Store 发布准备

---

## 关键技术挑战

| 挑战 | 方案 |
|------|------|
| `file://` 协议限制 | manifest 声明 + 用户手动启用"允许访问文件网址" |
| File System Access API 需用户手势 | Extension Page 中使用；保存按钮触发；IndexedDB 缓存句柄 |
| Mermaid 在 ShadowDOM 兼容 | `mermaid.render()` 返回 SVG string 注入 |
| 大文件性能 | 虚拟滚动 + AST 分块 + Web Worker |
| GitHub/GitLab DOM 变化 | 优先 API 获取 raw，DOM 作 fallback |

---

## 飞书风格核心设计变量

```css
--feishu-bg-page: #f5f6f7;          /* 灰色页面底 */
--feishu-bg-content: #ffffff;        /* 白色内容卡片 */
--feishu-brand-primary: #3370ff;     /* 飞书蓝 */
--feishu-text-primary: #1f2329;      /* 主文本近黑 */
--feishu-font-size-body: 15px;       /* 正文 15px */
--feishu-line-height: 1.75;          /* 宽松行高 */
--feishu-spacing-page: 54px;         /* 内容区大 padding */
```

**视觉特征**: H1 底线 | 引用蓝边条+浅蓝底 | 表格斑马纹+圆角 | 代码块圆角+语言标签 | TOC 蓝色左边条高亮

---

## Manifest V3 配置要点

```json
{
  "manifest_version": 3,
  "name": "Feishu MD Viewer",
  "permissions": ["activeTab", "storage", "contextMenus"],
  "host_permissions": ["file:///*", "https://github.com/*", "https://gitlab.com/*"],
  "content_scripts": [
    { "matches": ["file:///*/*.md", "file:///*/*.markdown"], "js": ["src/content/index.tsx"] },
    { "matches": ["https://github.com/*/*/blob/**/*.md", "https://gitlab.com/*/*/-/blob/**/*.md"], "js": ["src/content/index.tsx"] }
  ]
}
```

---

## 验证方案

1. **Phase 1**: 本地 `test.md`（含 Mermaid）通过 `file://` 打开 → 飞书风格 + 流程图
2. **Phase 2**: 目录跳转 + 滚动高亮 + 折叠
3. **Phase 3**: 编辑模式 + Mermaid 实时预览
4. **Phase 4**: 保存后本地文件内容已更新
5. **Phase 5**: GitHub .md 页面扩展生效
