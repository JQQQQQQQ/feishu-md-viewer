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
