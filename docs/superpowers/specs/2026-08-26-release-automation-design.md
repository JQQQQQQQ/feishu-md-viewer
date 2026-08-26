# GitHub 发布自动化设计

## 1. 背景与目标

Feishu Markdown Viewer 同时发布 Chrome 浏览器扩展和 VS Code 只读预览扩展。当前仓库已有统一质量门禁、两端构建和产物校验，但正式 GitHub Release 仍需要手工构建、压缩和上传。

本设计增加一个由 Git 标签触发的 GitHub Actions 发布工作流，目标是让维护者在完成版本更新并推送标签后，自动完成质量验证、两端打包和 Release 创建，同时避免错误版本或不完整产物被发布。

## 2. 范围与非目标

### 2.1 本次范围

- 新增独立的 GitHub Actions 发布工作流，不改变现有 PR/普通 push 的 CI 工作流。
- 监听格式为 `vX.Y.Z` 的标签，例如 `v0.1.1`。
- 发布前执行既有的单元测试、类型检查、Chrome 构建、VS Code 构建、VS Code 产物验证、发布产物检查和浏览器 E2E。
- 自动生成 Chrome ZIP 和 VS Code VSIX，并上传到同一个 GitHub Release。
- 校验 Git 标签版本与根 `package.json` 的 Chrome 项目版本一致；VS Code 保持独立版本号。
- 生成包含两端版本号、安装包名称和验证结果的中文 Release 说明。
- 工作流失败时不创建或更新正式 Release，并保留失败日志与测试报告。

### 2.2 非目标

- 不自动修改 `package.json`、Manifest 或 VS Code 版本号。
- 不自动提交版本更新或推送 Git 标签。
- 不改变 Chrome 与 VS Code 的独立版本策略。
- 不在 CI 中自动操作用户本机的 Windows VS Code GUI。
- 不删除或覆盖已经存在的 Release；重复标签直接失败，避免误替换已发布资产。

## 3. 发布入口与版本策略

维护者先在提交中更新根 `package.json` 的 Chrome 项目版本，并按需更新 `vscode-extension/package.json` 的 VS Code 版本。随后创建并推送标签：

```bash
git tag v0.1.1
git push origin v0.1.1
```

工作流仅接受完整三段数字版本标签。标签去掉 `v` 前缀后必须等于根 `package.json.version`；如果不一致，工作流在构建前失败。VS Code 版本从 `vscode-extension/package.json` 读取，不要求与标签相同，但会在 Release 说明和 VSIX 文件名中明确展示。

这样可以保持现有发布结构：一个 Release 同时提供两个平台的安装包，同时让两个平台按各自节奏演进。

## 4. 工作流架构

新增 `.github/workflows/release.yml`，主要阶段如下：

```text
push vX.Y.Z
      |
      v
准备运行环境与依赖缓存
      |
      v
版本预检 ----失败----> 停止，不创建 Release
      |
      v
质量门禁（单测/类型/两端构建/产物校验/E2E）
      |
      v
打包 Chrome ZIP + VS Code VSIX
      |
      v
再次检查待发布文件和版本
      |
      v
创建 GitHub Release 并上传两个资产
```

### 4.1 触发与并发

- `on.push.tags` 使用 `v*.*.*`，避免普通提交自动发布。
- 设置 `permissions: contents: write`，仅允许工作流读写当前仓库内容。
- 使用按标签命名的 `concurrency`，同一标签同时运行时取消旧任务，防止重复上传。
- 发布任务只在标签推送事件执行；是否允许手动重跑由 GitHub Actions 的重新运行能力承担，不增加容易误用的自由输入版本字段。

### 4.2 质量门禁

发布工作流复用仓库现有命令，不复制检查逻辑：

```bash
pnpm install --frozen-lockfile
TMPDIR=/tmp npm run verify:release
```

浏览器 E2E 在 Linux CI 中通过 `xvfb-run` 启动 headed Chromium，并安装 Playwright Chromium 依赖。发布工作流应设置 `RUN_E2E=1`，确保质量门禁不会把浏览器验收静默跳过。

如果任一固定门禁失败，工作流退出，不执行打包上传步骤。测试报告和 Playwright 报告使用 `if: always()` 上传为临时 Artifact，便于排查，但不等价于正式发布资产。

### 4.3 打包规则

- Chrome：先执行 `npm run build`，将根目录 `dist/` 的全部内容压缩为 `feishu-md-viewer-chrome-<chromeVersion>.zip`；ZIP 根部必须直接包含 `manifest.json`。
- VS Code：先执行 `npm run build:vscode`，再使用 `@vscode/vsce package --no-dependencies` 生成 VSIX；文件命名为 `feishu-md-viewer-vscode-<vscodeVersion>.vsix`。
- 所有正式资产写入 CI 临时目录，不提交到仓库。
- 打包后调用现有产物检查器，并增加对 ZIP/VSIX 文件存在、文件名版本和非空大小的检查。

### 4.4 Release 创建

使用 GitHub 官方 CLI `gh release create` 或官方维护的 Release Action，以当前标签作为 Release tag。Release 标题包含标签版本，正文由工作流生成，至少包含：

- Chrome 版本、VS Code 版本。
- 两个资产的下载文件名。
- 自动化门禁通过列表。
- Windows 原生 VS Code GUI 验收仍需按现有清单人工完成的说明。

创建前不允许覆盖已存在的同名 Release。创建命令应在资产都已生成且最终校验通过后才执行。

## 5. 可维护性设计

版本解析、标签校验和发布文件名生成放入独立的 Node 脚本模块，而不是把复杂字符串逻辑散落在 YAML shell 中。该模块提供可测试的纯函数，例如：

- `parseReleaseTag(tag)`：解析并验证 `vX.Y.Z`。
- `assertChromeVersionMatchesTag(tag, packageVersion)`：返回明确的错误信息。
- `createReleaseAssetNames(chromeVersion, vscodeVersion)`：生成稳定文件名。

工作流只负责编排命令、传递输出和调用 GitHub CLI；业务规则由脚本和单元测试保护。这样本地可以在不创建 Release 的情况下预检版本和生成文件名。

## 6. 错误处理与安全边界

- 标签格式错误、标签与 Chrome 版本不一致、依赖锁文件不一致时立即失败。
- 任一测试、构建、E2E、VSIX 打包或资产检查失败时不创建 Release。
- 发布命令使用 GitHub Actions 内置 `GITHUB_TOKEN`，不在仓库、日志或脚本中保存个人访问令牌。
- Release 只授予 `contents: write`，不授予 issues、pull requests 或其他写权限。
- 资产名称只由已校验的三段数字版本组成，避免路径穿越或 shell 注入。
- GitHub CLI 输出中不得打印令牌；失败日志可以上传，但不得包含 secrets。
- 已存在的 tag/Release 不执行覆盖上传；需要修复时应创建新的补丁版本。

## 7. 测试设计

### 7.1 单元测试

新增发布辅助模块测试，覆盖：

- `v0.1.1` 等有效标签可以解析。
- 缺少 `v`、包含预发布后缀、位数错误或包含非数字字符的标签被拒绝。
- 标签版本与 Chrome 版本一致时通过，不一致时给出中文错误。
- Chrome/VS Code 资产文件名版本正确且不含路径分隔符。

### 7.2 工作流静态检查

- 检查 `release.yml` 只由标签触发并声明 `contents: write`。
- 检查发布 job 显式启用 `RUN_E2E=1`、使用 `xvfb-run`，并在 Release 创建前完成最终资产校验。
- 检查工作流没有硬编码 token，也没有把构建产物写入源码目录后提交。

### 7.3 本地发布演练

不推送标签、不创建 Release 的情况下执行：

```bash
npm run verify:release
npm run build
npm run build:vscode
```

然后在临时目录打包并运行资产检查，确认 ZIP 根结构、VSIX 必要文件、两端版本和文件名均符合规则。真实 GitHub Release 触发由后续推送测试标签完成；生产版本继续使用正式 `vX.Y.Z` 标签。

## 8. 验收标准

- 推送 `v0.1.1` 后，工作流自动启动且不需要在网页填写版本号。
- 质量门禁全部通过后，GitHub Release 自动创建并包含 Chrome ZIP 与 VSIX 两个可下载资产。
- Release 正文能明确看到 Chrome 和 VS Code 的独立版本号。
- 标签版本错误、测试失败或打包失败时，不会出现半成品正式 Release。
- 现有 `ci.yml` 的 PR/push 检查行为不变。
- 不改变浏览器预览、VS Code 预览、表格、目录、Mermaid 和本地文件刷新功能。

