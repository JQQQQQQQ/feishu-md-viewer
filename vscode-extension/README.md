# Feishu Markdown Viewer for VS Code

在 VS Code 中以飞书文档风格**只读预览**本地 Markdown 文件。该扩展复用项目的 Markdown、表格、代码块、图片和 Mermaid 渲染能力；不会修改原始文件，也不会在预览中写回内容。

## 本地 F5 调试

请在 VS Code 中打开**仓库根目录**，并使用 Node.js 20+。首次运行先安装依赖：

```bash
pnpm install
```

仓库已提供 `.vscode/launch.json`。按 `F5` 并选择 **运行 Feishu Markdown Viewer VS Code 扩展** 后，VS Code 会先执行 `npm: build:vscode`，再打开一个 Extension Development Host 窗口。该脚本会同时生成：

- `vscode-extension/out/extension.js` 及 Provider 等 VS Code 宿主代码；
- `vscode-extension/dist/` 下的 Webview 资源。

在新窗口中打开任意 `*.md` 或 `*.markdown` 文件，即可验证默认的 Feishu 只读预览。修改宿主代码或 Webview 代码后，再次按 `F5` 即可重建并启动新的开发宿主。

也可在终端手动构建：

```bash
pnpm build:vscode:host
pnpm build:vscode
```

> `pnpm build` 仍只构建 Chrome 扩展，输出至根目录 `dist/`；它不会替代 VS Code 宿主的 `out/extension.js`，也不会覆盖 `vscode-extension/dist/`。

## 打包并安装到本机 VS Code

先构建宿主和 Webview，再在 `vscode-extension/` 目录打包 VSIX：

```bash
pnpm build:vscode
cd vscode-extension
pnpm dlx @vscode/vsce package --no-dependencies
```

这会生成类似 `feishu-md-viewer-vscode-0.1.0.vsix` 的文件。随后使用任一方式安装：

1. 在 VS Code 的扩展视图中选择 **从 VSIX 安装…**，选择该 `.vsix` 文件；或
2. 在仓库根目录运行 `code --install-extension vscode-extension/feishu-md-viewer-vscode-0.1.0.vsix`。

安装完成后重新加载 VS Code 窗口，再打开 Markdown 文件。

## 默认预览行为

- `*.md` 和 `*.markdown` 默认由 **Feishu Markdown Preview** 打开，优先级为 `default`。
- 预览是只读的；保存、另存为和写回均仍由 VS Code 原生编辑器负责。
- 文件在编辑器或磁盘上发生新版本更新时，预览会刷新。
- VS Code 切换浅色、深色或高对比主题时，预览会随之更新。
- 空文件会显示“Markdown 文档为空”；读取或渲染失败会显示明确状态，而不会持续加载。

## 预览设置的全局持久化

预览顶部的主题、字号、目录滚动方式和正文对齐设置由扩展宿主统一保存到 VS Code 的全局扩展状态中：

- 同一 VS Code 实例内打开的所有 Markdown 预览使用同一份设置；
- 在一个预览页修改设置后，其他已经打开的预览页会同步更新；
- 关闭预览、切换编辑器标签或重新打开 VS Code 后，设置仍会保留；
- 设置不会写入 Markdown 文件，也不依赖某一个 Webview 面板的临时状态。
- 表格列宽会按 Markdown 文件 URI 和表格块的持久身份独立保存；编辑表格内容、在同一章节插入新表格或重新打开同一文件后仍会恢复，不同表格和不同文件不会互相套用列宽。旧版本按内容指纹保存的列宽也会自动兼容读取。

## 使用原生文本编辑器回退

需要编辑 Markdown 时，使用以下任一方式回到 VS Code 原生编辑器：

1. 在编辑器标签页上右键，选择 **Reopen Editor With…（重新打开方式）**，再选择 **Text Editor（文本编辑器）**。
2. 打开命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`），运行 **使用原生文本编辑器重新打开**。

完成编辑和保存后，可再次通过 **Reopen Editor With… → Feishu Markdown Preview** 切回只读预览。这个回退路径始终保留，因此预览异常时也可以直接编辑源文件。

## 验证

```bash
TMPDIR=/tmp npm test -- --run vscode-extension/tests
npx tsc -p vscode-extension/tsconfig.json --noEmit
pnpm build:vscode
```

发布前请按仓库根目录的 [发布前验收清单](../docs/release-acceptance.md) 完成自动门禁和 Windows 原生 VS Code 手工验收。自动化测试覆盖 Provider、Webview 和构建产物；真实 VS Code 界面、主题、表格复制及 Mermaid 加载仍需在干净 Profile 中复核。
