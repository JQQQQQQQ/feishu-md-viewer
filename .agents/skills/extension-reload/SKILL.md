---
name: extension-reload
description: Use when building, refreshing, or verifying the local unpacked Feishu MD Viewer Chrome extension from this project, especially when the user asks to reload the extension or refresh the current Markdown preview.
---

# Feishu MD Viewer 扩展重载

## 适用范围

这个 skill 只用于本项目的 Chrome 解压版扩展。它不负责 Chrome Web Store 安装版，也不替代 VS Code 扩展的构建或重载流程。

## 标准入口

优先使用项目已有的自动化脚本，不要手工操作 `chrome://extensions`：

```powershell
.\scripts\extension\reload-extension.cmd
```

脚本会重新构建根目录 `dist/`，连接当前 Chrome，查找已注入 Feishu MD Viewer 的 Markdown 标签页，发送开发重载消息，等待页面重新注入后再断开自动化连接。

如果只需要刷新、不需要重新构建：

```powershell
.\scripts\extension\reload-extension.cmd --no-build
```

等价的 npm 入口：

```bash
npm run extension:reload
npm run extension:reload -- --no-build
```

## 执行前检查

1. Chrome 已打开一个 Markdown 预览页，并且页面中存在 `#feishu-md-viewer-host`。
2. Chrome 已允许 `playwright-cli` 连接；首次使用时执行：

   ```powershell
   playwright-cli attach --extension=chrome
   ```

3. 当前扩展是从本项目根目录 `dist/` 加载的解压版。

在 WSL 工作区中，脚本会自动调用 Windows 的 `%APPDATA%\npm\playwright-cli.cmd`，并使用 `/mnt/c/Users/Q` 作为 Windows CLI 会话目录。不要把 WSL UNC 路径作为 `cmd.exe` 的工作目录。

## 成功判据

只有同时看到以下证据才报告重载成功：

- `RELOAD_EXTENSION_ACK`；
- 返回内容中 `response.success` 为 `true`；
- 当前 Markdown 标签页完成重新加载，并重新出现 `#feishu-md-viewer-host`；
- 脚本输出 `扩展已触发重载，当前 Markdown 页面应已重新注入最新版本。`。

`playwright-cli` 的进程退出码可能与页面执行结果不一致，必须优先检查 ACK 和 `### Error` 区块，不能只看退出码。

## 故障处理

- 找不到 Markdown 预览容器：先在 Chrome 打开本地、GitHub 或 GitLab Markdown 预览页，再重试。
- 无法连接 Chrome：确认 Chrome 仍在运行、连接扩展已启用，并重新执行 `playwright-cli attach --extension=chrome`。
- 构建失败：停止重载，先运行 `npm run build` 修复类型或构建错误。
- 脚本只显示连接页：说明自动化会话没有实际 Markdown 标签页；重新打开预览页后再执行。

详细命令说明见 [`docs/extension-reload.md`](../../../docs/extension-reload.md)。
