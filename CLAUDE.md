# Feishu MD Viewer

## 项目概述

Chrome 浏览器扩展（Manifest V3），以飞书文档风格渲染和编辑 Markdown + Mermaid 文件。

## 技术栈

- **构建**: Vite 5 + CRXJS Vite Plugin
- **框架**: React 18 + TypeScript 5
- **样式**: Tailwind CSS 3 + CSS Variables (飞书主题)
- **MD 解析**: unified + remark + rehype + rehype-react
- **Mermaid**: mermaid.js (render API)
- **编辑器**: CodeMirror 6 (Mermaid 编辑)
- **状态管理**: Zustand
- **文件保存**: File System Access API

## 核心功能

1. Markdown 飞书风格渲染
2. Mermaid 流程图预览与在线编辑
3. 可折叠目录导航 (TOC)
4. 文档编辑 (阅读/编辑模式切换)
5. 实时保存到源文件
6. 支持本地 file:// + GitHub + GitLab

## 实施计划

详见 `docs/IMPLEMENTATION_PLAN.md`，分 6 个 Phase 执行，当前从 Phase 1 (MVP) 开始。

## 开发命令

```bash
pnpm install        # 安装依赖
pnpm dev            # 启动开发服务器 (HMR)
pnpm build          # 构建扩展
pnpm preview        # 预览构建产物
```

## 协作设定

- 先结论后细节，给可执行步骤
- 附风险提示和测试建议
- 代码优先标准表达，避免口语化
