# Chrome 扩展一键重载

`scripts/extension/reload-extension.cmd` 用于在 Windows 上自动刷新本地解压版 Feishu MD Viewer。

## 使用方式

1. 打开 Chrome，并打开一个已经显示 Feishu MD Viewer 预览的 Markdown 页面。
2. 在项目根目录双击 `scripts/extension/reload-extension.cmd`，或在终端执行：

   ```powershell
   .\scripts\extension\reload-extension.cmd
   ```

脚本会依次执行：

1. 运行 `npm run build`，更新根目录 `dist/`。
2. 连接当前 Chrome 会话。
3. 通过当前 Markdown 页面发送开发重载消息。
4. 等待扩展重新注入并刷新当前页面。
5. 断开自动化连接，但不会关闭 Chrome 或标签页。

## 快速重载

如果刚刚已经构建过，只想重载扩展，可以跳过构建：

```powershell
.\scripts\extension\reload-extension.cmd --no-build
```

也可以使用 npm：

```powershell
npm run extension:reload
npm run extension:reload -- --no-build
```

## 前置条件与限制

- Chrome 中必须有一个当前已注入 Feishu MD Viewer 的 Markdown 预览页。
- 本机需要安装并可调用 `playwright-cli`；默认查找 `%APPDATA%\npm\playwright-cli.cmd`。
- 该脚本只适用于本地解压版扩展。Chrome Web Store 安装版不能通过页面消息直接替换扩展代码。
- 如果出现“无法连接 Chrome”，先确认已通过 `playwright-cli attach --extension=chrome` 授权当前浏览器连接。
