# GitHub 自动发布指南

本项目通过 `.github/workflows/release.yml` 自动构建并发布 Chrome 浏览器扩展和 VS Code 只读预览扩展。发布入口是 Git 标签，不会因为普通提交或 Pull Request 自动创建正式 Release。

## 发布前准备

1. 更新根目录 `package.json` 的 Chrome 项目版本，例如 `0.1.1`。
2. 如果 VS Code 扩展也有版本变更，更新 `vscode-extension/package.json`，例如 `0.1.7`。两个平台允许使用不同版本号。
3. 提交并推送版本变更。
4. 确认工作区没有未提交的版本修改，再创建标签：

   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```

标签版本必须与根 package.json 一致。例如根项目是 `0.1.1` 时，必须推送 `v0.1.1`，不能推送 `v0.1.0` 或 `v0.1.1-beta.1`。

## 自动执行内容

工作流会依次执行：

- 安装锁定依赖。
- 校验标签、Chrome 版本和 VS Code 版本。
- 执行单元测试、类型检查、Chrome 构建、VS Code 构建、跨端入口检查和发布产物检查。
- 在 `xvfb-run` 中执行浏览器 Playwright E2E。
- 生成 `feishu-md-viewer-chrome-<Chrome版本>.zip`。
- 生成 `feishu-md-viewer-vscode-<VS Code版本>.vsix`。
- 检查 ZIP 根部的 `manifest.json`、VSIX 必要文件和版本。
- 创建同名 GitHub Release，并上传两个安装包。

只有所有门禁和最终资产检查通过后，才会执行 Release 创建命令。测试报告、Playwright 报告和临时打包文件会作为诊断 Artifact 保存，不会提交到仓库。

## 版本和资产

| 产品         | 版本来源                                    | Release 资产                          |
| ------------ | ------------------------------------------- | ------------------------------------- |
| Chrome 扩展  | 根 `package.json`，必须匹配标签             | `feishu-md-viewer-chrome-<版本>.zip`  |
| VS Code 扩展 | `vscode-extension/package.json`，可独立演进 | `feishu-md-viewer-vscode-<版本>.vsix` |

## 失败处理

- 标签格式、Chrome 版本或 VS Code 版本非法时，工作流会在构建前失败。
- 任一测试、E2E、构建、VSIX 打包或资产检查失败时，不会创建正式 Release。
- 已有同名标签或 Release 时不会覆盖已有 Release。修复问题后应提交新的补丁版本并创建新标签。
- 工作流使用 GitHub Actions 内置 `GITHUB_TOKEN`，只授予当前仓库 `contents: write` 权限，不需要配置个人访问令牌。
- 构建产物写入运行器临时目录，不会自动修改或提交源代码。

## 发布后检查

1. 打开 GitHub Actions，确认 `Release` 工作流的所有步骤均为绿色。
2. 打开对应 GitHub Release，确认两个资产都存在且文件大小非零。
3. 下载 Chrome ZIP，在 Chrome 扩展管理页使用“加载已解压的扩展”验证。
4. 下载 VSIX，在 Windows 原生 VS Code 中使用“从 VSIX 安装…”验证。
5. 按[发布前验收清单](release-acceptance.md)完成真实 Windows VS Code GUI 验收。自动化检查通过不能替代这一步。

## 本地预检

不推送标签、不创建 GitHub Release 时，可以执行：

```bash
RELEASE_TAG=v0.1.0 npm run release:metadata
TMPDIR=/tmp npm run verify:release
TMPDIR=/tmp npm run build
TMPDIR=/tmp npm run build:vscode
```

本地若要演练打包，可使用临时输出目录：

```bash
TMPDIR=/tmp npm run package:release -- --tag v0.1.0 --output /tmp/feishu-release-smoke
VSIX_PATH=/tmp/feishu-release-smoke/feishu-md-viewer-vscode-0.1.6.vsix npm run check:artifacts
```

上述命令只生成本地临时文件，不会调用 `gh release create`，也不会修改已有 GitHub Release。
