# VS Code Markdown 预览验证报告

验证日期：2026-08-14  
验证工作区：`/root/workspace/feishu-md-viewer`

## 结论

Chrome 扩展与 VS Code 扩展的自动化构建、类型检查和回归测试均已执行成功。新增构建隔离脚本确认 Chrome 输出目录为 `dist/`、VS Code Webview 输出目录为 `vscode-extension/dist/`，且 VS Code 扩展 `package.main` 指向已生成的宿主入口 `vscode-extension/out/extension.js`。脚本扫描了 64 个 Chrome JavaScript 文件，未发现 `vscode` API 导入。

VS Code 手工验收处于 **BLOCKED**，而非通过：当前 WSL 环境无法正常调用 Windows VS Code CLI，且没有可安装的 VSIX 打包工具或现成 VSIX。自动化结果不能替代真实 VS Code 的默认预览、原生编辑器切换和外部文件刷新验证。

## 自动化验证记录

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `TMPDIR=/tmp npm test` | 通过 | 35 个测试文件、238 项测试通过。Mermaid 的 JSDOM 降级路径会输出 `getBBox` 诊断，但测试命令以状态码 0 完成。 |
| `npm run typecheck` | 通过 | 根目录 `tsc --noEmit` 以状态码 0 完成。 |
| `npm run build` | 通过 | Chrome 扩展构建至 `dist/`。Vite 输出大于 500 kB 的 chunk 建议，不影响构建状态。 |
| `npm run build:vscode` | 通过 | 先执行 `tsc -p vscode-extension/tsconfig.host.json`，生成 `vscode-extension/out/extension.js`；随后 Vite 将 Webview 生成至 `vscode-extension/dist/`。Vite 的 CJS Node API 弃用提示和 chunk 大小提示均为非阻断警告。 |
| `TMPDIR=/tmp npm run test:vscode` | 通过 | 5 个测试文件、32 项 VS Code 相关测试通过，包含构建隔离脚本的 5 项回归测试。 |
| `npm run verify:vscode` | 通过 | 输出 Chrome `dist/`、VS Code `vscode-extension/dist/`、宿主 `vscode-extension/out/extension.js`；扫描 64 个 Chrome JavaScript 文件，未发现 VS Code API 导入。 |
| `git diff --check` | 通过 | 未报告空白错误。 |

完整执行链如下：

```bash
TMPDIR=/tmp npm test
npm run typecheck
npm run build
npm run build:vscode
npm run verify:vscode
git diff --check
```

## 构建隔离断言

`scripts/vscode/verify-preview-build.mjs` 在真实构建产物上执行以下检查：

1. 根目录 Chrome `dist/` 和 `vscode-extension/dist/` 都必须存在，且解析后的目录不同。
2. `vscode-extension/package.json` 的 `main` 必须存在，并且其文件必须位于 `vscode-extension/tsconfig.host.json` 声明的宿主 `outDir` 内。
3. Chrome `dist/` 中至少要有一个 JavaScript 产物；逐个扫描 `.js`、`.mjs` 与 `.cjs`，拒绝静态、动态或 CommonJS 形式的 `vscode` API 导入。

对应单元测试使用临时构建目录覆盖两种情形：有效的隔离产物必须通过；向 Chrome JavaScript 文件注入 `import * as vscode from 'vscode'` 时必须失败。

## VS Code 手工验收：BLOCKED

目标手工步骤尚未执行：

1. 在干净 VS Code Profile 中安装打包后的 VSIX。
2. 打开 `.md` 文件，确认默认打开 Feishu 只读预览。
3. 使用 **Reopen Editor With → Text Editor** 修改并保存内容。
4. 切回 Feishu Markdown Preview，确认显示最新文本。
5. 在编辑器外修改文件，确认已打开的预览刷新。

阻塞证据：

- 系统可解析到 `/mnt/c/Users/Q/AppData/Local/Programs/Microsoft VS Code/bin/code`，但执行 `code --version` 返回 `WSL (31) ERROR: UtilBindVsockAnyPort:309: socket failed 1`，无法启动或确认 Windows VS Code CLI。
- 当前环境未找到 `vsce`，仓库也没有现成的 `.vsix` 文件；因此无法在不额外安装打包工具的情况下完成 VSIX 安装。
- 本任务未安装新的全局工具或修改用户 VS Code Profile，以避免把环境修复或全局软件变更混入扩展验证。

解除阻塞后，应在 Windows 原生 VS Code 中执行：`npm run build:vscode`，使用 VSIX 打包工具生成扩展包，随后以干净 Profile 安装并完成上述五个步骤。只有实际观察到默认预览、原生编辑器回退和外部修改刷新后，手工验收才可标记为通过。
## 产物验证补强

验证脚本现在同时检查 `vscode-extension/dist/index.html`、至少一个 Webview JavaScript/CSS 产物，以及 index.html 引用的相对资源均真实存在；缺少入口或被引用资源时会失败。回归测试覆盖了 index.html、JavaScript 和 CSS 入口缺失场景。
