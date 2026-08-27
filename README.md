# Feishu Markdown Viewer

以飞书文档风格阅读 Markdown 和 Mermaid 的 Chrome 扩展，同时提供 VS Code 只读预览扩展。项目重点是阅读体验：清晰的目录、稳定的滚动、可复制的表格和可靠的图表预览。

## 功能概览

### Markdown 阅读预览

- 标题层级、标题定位和可折叠目录
- 标题缩进、层级留白和标题链接复制
- 段落、列表、有序列表、任务列表和引用
- 行内代码和多语言代码块
- GFM 表格、分隔线、链接和图片
- Callout / 提示块和错误内容降级显示
- 浅色主题、深色主题、字号调节和正文左对齐 / 居中

### 表格交互

- 单元格点击和多单元格选择
- 点击表格上边框选择整列，点击左边框选择整行
- 拖拽边框扩大整行 / 整列选择范围
- 选中内容复制为 TSV，粘贴到 Excel 时保留表格结构和表头
- 表头固定、横向滚动和左右可滚动提示阴影
- 支持宽表布局和列宽拖拽调整
- 浏览器和 VS Code 中按文件与表格身份持久化列宽

### Mermaid 图表

- 支持流程图、时序图、类图、状态图、甘特图、饼图、思维导图等多种 Mermaid 类型
- 图表默认以预览形式展示，并支持打开预览弹窗
- 支持复制 Mermaid 源码、导出 SVG 和 PNG
- 图表按视口懒加载，减少长文档首次渲染压力
- Mermaid 语法错误时显示错误状态，不阻塞其余 Markdown 内容
- 浅色和深色主题下保持可读

### 文件更新

- 支持本地 `file://` Markdown 文件
- 本地文件可以选择自动刷新或手动刷新
- 自动刷新时只替换正文区域，并尽量保留当前滚动位置
- GitHub 和 GitLab Markdown 页面支持预览

## 安装

### Chrome 扩展

从 [GitHub Release v0.1.1](https://github.com/JQQQQQQQ/feishu-md-viewer/releases/tag/v0.1.1) 下载：

[下载 Chrome 扩展](https://github.com/JQQQQQQQ/feishu-md-viewer/releases/download/v0.1.1/feishu-md-viewer-chrome-0.1.1.zip)

安装步骤：

1. 下载并解压 ZIP 文件。
2. 在 Chrome 地址栏打开 `chrome://extensions/`。
3. 打开右上角的“开发者模式”。
4. 点击“加载已解压的扩展”，选择解压后的目录。
5. 如果要预览本地文件，在扩展详情中打开“允许访问文件网址”。

### VS Code 扩展

当前 VS Code 扩展版本为 `0.1.6`，从 Release 下载：

[下载 VS Code 扩展](https://github.com/JQQQQQQQ/feishu-md-viewer/releases/download/v0.1.1/feishu-md-viewer-vscode-0.1.6.vsix)

安装方式：

1. 在 VS Code 扩展面板中选择“从 VSIX 安装…”，选择下载的 `.vsix` 文件；或
2. 在终端执行：

   ```bash
   code --install-extension feishu-md-viewer-vscode-0.1.6.vsix
   ```

安装后重新加载 VS Code，打开任意 `.md` 或 `.markdown` 文件即可进入 Feishu 只读预览。

VS Code 预览不会修改原始 Markdown 文件。需要编辑时，可以在编辑器标签上右键选择“重新打开方式… → 文本编辑器”，编辑完成后再切回 Feishu Markdown Preview。

## 使用方式

### 在 Chrome 中预览

- 打开本地 `.md` / `.markdown` 文件。
- 或打开 GitHub / GitLab 中的 Markdown 文件页面。
- 使用顶部工具栏调整主题、字号、目录滚动方式和正文对齐。
- 在表格中点击单元格、行边框或列边框进行选择，然后使用 `Ctrl/Cmd + C` 复制。
- 本地文件发生变化后，根据设置自动刷新或点击提示进行手动刷新。

### 在 VS Code 中预览

- `.md` 和 `.markdown` 默认使用 Feishu Markdown Preview 打开。
- 预览为只读模式，编辑仍使用 VS Code 原生文本编辑器。
- 主题、字号、目录滚动、正文对齐和表格列宽会持久化保存。
- 文件被外部程序修改后，预览会收到更新并刷新内容。

## 本地开发

要求 Node.js 20+，推荐使用 pnpm：

```bash
pnpm install
```

### Chrome 扩展开发

```bash
pnpm dev
```

### 构建 Chrome 扩展

```bash
pnpm build
```

构建产物位于根目录的 `dist/`，可以在 Chrome 的扩展管理页通过“加载已解压的扩展”安装。

### 构建 VS Code 扩展

```bash
pnpm build:vscode
pnpm verify:vscode
```

宿主代码输出到 `vscode-extension/out/`，Webview 资源输出到 `vscode-extension/dist/`。

在 VS Code 中打开仓库根目录，按 `F5` 并选择“运行 Feishu Markdown Viewer VS Code 扩展”，可以启动 Extension Development Host。

### 打包 VSIX

```bash
pnpm build:vscode
cd vscode-extension
pnpm dlx @vscode/vsce package --no-dependencies
```

### 测试和发布检查

```bash
pnpm test
pnpm typecheck
pnpm test:e2e:install
pnpm verify:release
```

浏览器 E2E 使用 Playwright。Linux CI 环境需要通过 `xvfb-run` 启动 headed Chromium，以加载 Chrome 扩展。

发布验收资料：

- [发布前验收清单](docs/release-acceptance.md)
- [发布验收报告](docs/release-report.md)

### 自动发布

仓库已配置 GitHub Actions 标签发布工作流。准备发布时，先在提交中更新根目录 Chrome 项目版本，并按需更新 `vscode-extension/package.json` 的 VS Code 版本，然后提交这些版本变更：

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

推送标签后，GitHub Actions 会自动执行完整质量门禁、浏览器 E2E、Chrome ZIP 和 VSIX 打包，并在门禁通过后创建同名 GitHub Release。Chrome 标签版本必须与根 `package.json` 版本一致；VS Code 使用独立版本号，两个安装包会显示在同一个 Release 中。

不需要手动上传构建产物。请在 GitHub Actions 页面确认工作流通过，再从 Release 下载两个安装包。标签格式错误、版本不一致、测试失败或打包失败都会阻止正式 Release；已有 Release 不会被覆盖。完整规则见[自动发布指南](docs/release-automation.md)。

## 版本说明

Chrome 扩展和 VS Code 扩展使用独立版本号：

| 产品         | 当前版本 |
| ------------ | -------- |
| Chrome 扩展  | `0.1.1`  |
| VS Code 扩展 | `0.1.6`  |

两个版本会在同一个 GitHub Release 中发布，但安装包、版本号和发布节奏可以独立演进。

## 已知事项

- VS Code 原生界面手工验收需要在 Windows VS Code 的干净 Profile 中补充完成。
- 浏览器扩展的完整 Playwright E2E 在 Linux 本地运行时需要可用的 X Server；CI 已配置 `xvfb-run`。
- `test-e2e.md` 是用于覆盖 Markdown、表格、Mermaid、刷新和错误降级场景的综合测试文档。

## 许可证

当前仓库未声明正式开源许可证。如需对外分发，建议先补充 LICENSE 文件并明确授权范围。
