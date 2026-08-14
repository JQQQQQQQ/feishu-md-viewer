# VS Code Markdown 只读预览设计

## 目标

让 VS Code 中打开的 `.md` 文件默认使用 Feishu 风格的只读预览，同时保留 VS Code 原生文本编辑器作为明确的回退入口。Chrome 扩展继续按现有方式工作，不改变其 Manifest V3、GitHub/GitLab、本地文件和页面注入行为。

## 范围

### 本次实现

- 新增 VS Code 扩展入口，注册 Markdown Custom Editor。
- `.md` 文件双击时优先打开 Feishu 只读预览。
- 预览展示现有 Markdown 能力：标题、目录、表格、代码块、引用、Callout、图片和 Mermaid。
- 文件内容由 VS Code 文档提供，外部修改后刷新 Webview。
- VS Code 主题切换时同步预览主题。
- 空文件、读取失败和渲染异常显示可理解的错误或空状态。
- 通过 `Reopen Editor With -> Text Editor` 使用原生编辑器。
- Chrome 扩展和 VS Code 扩展分别构建、测试、打包。

### 明确不做

- VS Code 预览内编辑 Markdown。
- 从 VS Code 预览写回文件。
- 把 VS Code 的 Custom Editor 注册逻辑加入 Chrome 扩展 Manifest。
- 在第一阶段增加 VS Code 专用设置面板、在线仓库认证或文件保存功能。

## 方案选择

采用“共享只读渲染层 + 独立 VS Code Webview 入口”。当前 `src/viewer/App.tsx` 和 Markdown 管线作为共享能力，Chrome 保持现有 `viewer-entry.tsx`，VS Code 使用独立的 Webview bootstrap。VS Code 扩展只负责文档生命周期和消息传递，渲染层不依赖 Chrome API。

相比复用本地 HTTP 页面，这种方式没有端口、服务进程和跨域依赖；相比复制渲染代码，可以避免 Chrome 和 VS Code 的 Markdown 视觉行为逐渐分叉。

## 组件边界

### 共享预览层

- 接收 `markdown`、`source`、主题和只读展示配置。
- 输出现有 Feishu 阅读态 DOM。
- 不读取 `window.location` 来决定文档内容。
- 不调用 `chrome.*`、VS Code API 或文件写入 API。

### Chrome 入口

- 保持现有 URL 校验、网络/本地文件读取和 Chrome 页面注入逻辑。
- 将加载后的文本传给共享预览层。

### VS Code 扩展宿主

- 注册 `feishu-md-viewer.markdownPreview` Custom Editor，匹配 `*.md` 和 `*.markdown`。
- `priority: "default"`，使双击 Markdown 时优先选择 Feishu 预览。
- 以只读方式打开文档，不实现保存、另存为和写回。
- 监听 `TextDocument` 内容变化，把最新文本和版本号发送给 Webview。
- 处理 Webview ready、主题变化和 dispose 生命周期。

### VS Code Webview

- 使用 `webview.asWebviewUri` 加载打包后的 JS/CSS。
- 使用严格 CSP 和随机 nonce；不允许内联脚本和任意远程脚本。
- 只通过 `postMessage` 接收文档内容、主题和状态。
- 内容变化时以版本号丢弃过期消息，避免快速编辑造成旧内容覆盖新内容。

## 数据流

```text
VS Code TextDocument
        |
        | openCustomDocument / onDidChangeTextDocument
        v
CustomEditorProvider
        |
        | postMessage({ type: "document", text, version })
        v
VS Code Webview bootstrap
        |
        v
共享 Feishu Markdown 预览层
```

Webview 不反向写入文档。关闭预览后由 VS Code 管理文档生命周期；用户需要修改时，使用“重新打开方式 → 文本编辑器”。

## 文件和构建结构

建议新增独立目录 `vscode-extension/`，包括：

- `package.json`：VS Code 扩展元数据、Custom Editor 贡献点和命令。
- `src/extension.ts`：扩展激活和 Provider 注册。
- `src/MarkdownPreviewProvider.ts`：文档打开、更新、Webview 生命周期。
- `webview/entry.tsx`：Webview bootstrap，连接共享预览层。
- `webview/index.html`：最小宿主 HTML 和 CSP 占位符。
- `README.md`：安装、默认打开行为和原生编辑器回退说明。

VS Code 构建产物不得覆盖 Chrome 的 `dist/`。Chrome 继续使用根目录的 Vite 构建；VS Code 使用独立输出目录，例如 `vscode-extension/dist/`。

## 主题和资源

- VS Code Webview 通过宿主发送 `light`、`dark` 或高对比主题状态。
- 共享 CSS 使用已有变量，并在 Webview 入口设置对应主题 class。
- 图片和 Mermaid 资源不使用 `file://` 或远程不受控脚本；Markdown 图片 URL 经过现有安全处理。
- Webview 资源全部转换为 `webview.asWebviewUri`，CSP 只允许自身资源。

## 错误处理

- 无法打开文档：显示文件路径和 VS Code 错误信息，保持原生编辑器可回退。
- 空文件：显示空文档状态，不报错。
- Markdown 或 Mermaid 单块渲染失败：保留其他块，失败块显示降级内容。
- Webview 初始化失败：显示重试提示，不循环创建面板。
- 版本号不匹配：丢弃旧文档消息。

## 测试策略

### 共享层回归

- 运行现有完整单元测试、类型检查和 Chrome 构建。
- 增加入口隔离断言：Chrome 入口仍然存在，VS Code API 不会被打进 Chrome Manifest 入口。

### VS Code Provider 单元测试

- `.md` 文件匹配和默认 Custom Editor 注册。
- 打开文档后发送初始内容。
- 文档变更发送新版本，旧版本消息不覆盖新版本。
- dispose 后不再发送消息。
- Provider 不提供写回行为。

### Webview 测试

- 接收 Markdown 后渲染标题、表格、代码块、图片和 Mermaid。
- 空内容和错误状态。
- light/dark 主题切换。
- 恶意 HTML、脚本和不受控资源不会执行。

### 手工验收

1. 在 VS Code 打开任意 `.md`，确认默认显示 Feishu 预览。
2. 修改文件并保存，确认预览更新。
3. 执行“重新打开方式 → 文本编辑器”，确认可以原生编辑。
4. 再切回 Feishu 预览，确认使用最新内容。
5. 构建 Chrome 扩展并加载，确认浏览器端已有功能无回归。

## 交付物

- VS Code 扩展源代码和独立构建脚本。
- 中文安装与使用说明。
- Provider、Webview 和安全相关测试。
- Chrome 扩展回归测试结果。

