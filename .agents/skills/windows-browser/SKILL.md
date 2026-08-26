---
name: windows-browser
description: Use when 需要从 WSL 操控 Windows 本机浏览器，或遇到截图超时、元素不稳定、Mermaid 异步加载、Chrome 连接和 playwright-cli 路径问题。
allowed-tools: Bash(cmd.exe:*) Bash(playwright-cli:*)
---

# WSL → Windows 浏览器自动化

禁止在 WSL 中直接 `playwright-cli open`，那会启动 WSLg Linux Chrome。

## CLI 路径检查

Windows 上 `playwright-cli.cmd` 可能没有加入 PATH。首次执行前先检查：

```bash
cmd.exe /c "cd /d C:\Users\Q && where playwright-cli.cmd"
```

如果没有输出，使用 npm 全局目录中的绝对路径：

```text
C:\Users\Q\AppData\Roaming\npm\playwright-cli.cmd
```

下文中的 `playwright-cli.cmd` 均可替换为该绝对路径。每次执行都使用 `cd /d C:\Users\Q`，避免从 WSL UNC 路径启动 CMD 导致目录切换失败。

## 页面稳定与截图验收

截图前必须先判断页面是否稳定。`playwright-cli screenshot` 默认会等待字体和目标元素稳定，等待上限约为 5 秒；GitHub Markdown 页面包含 Mermaid 懒加载、主题切换和目录滚动动画时，立即截图容易出现 `waiting for fonts to load` 或 `waiting for element to be stable` 超时。

### 标准截图流程

```bash
# 1. 打开或切换页面
cmd.exe /c "cd /d C:\Users\Q && playwright-cli.cmd -s=chrome goto <url>"

# 2. 等待首屏异步内容完成，再获取最新快照
cmd.exe /c "cd /d C:\Users\Q && ping -n 3 127.0.0.1 >nul && playwright-cli.cmd -s=chrome snapshot --filename C:\Users\Q\page-snapshot.md"

# 3. 优先截当前 viewport；文件路径相对 C:\Users\Q
cmd.exe /c "cd /d C:\Users\Q && playwright-cli.cmd -s=chrome screenshot --filename C:\Users\Q\page.png"
```

如果 CLI 不在 PATH，以上命令中的 `playwright-cli.cmd` 改为 `C:\Users\Q\AppData\Roaming\npm\playwright-cli.cmd`。

执行 `click`、`reload`、主题切换或目录定位后，必须重新 `snapshot`，再使用新快照中的元素引用。禁止复用切换前的 `fxx` 引用。

### Mermaid 与滚动页面

- 快照中出现 `即将渲染...` 或 `Loading` 时，不要截 Mermaid 区块；等待进入 iframe、SVG 或错误态后再截。
- 点击目录定位后，等待滚动结束再截图；不要在滚动动画过程中截局部元素。
- 主题切换会触发 Mermaid 重渲染，切换后重新等待并获取快照。
- 页面很长时优先截 viewport，不要默认截完整页面；完整页面可能在异步区块持续改变高度时超时。

### 分层重试

1. 首次尝试：稳定页面后执行 viewport 截图。
2. 需要局部截图：重新 `snapshot`，使用最新引用截目标元素。
3. 仍报 `element is not stable`：先等待 1–2 秒；必要时通过 `eval` 临时关闭目标页面的 CSS `animation` 和 `transition`，然后重新 `snapshot` 和截图。
4. 仍失败时，记录截图阶段、页面 URL、快照、console；不要反复使用旧引用或盲目增加等待时间。

### 失败诊断

| 错误阶段 | 优先检查 |
| --- | --- |
| `waiting for fonts to load` | 页面是否刚打开、字体是否仍在加载；等待后重试 viewport 截图 |
| `waiting for element to be stable` | 目录滚动、主题动画、Mermaid 重渲染；重新快照并等待布局稳定 |
| `Target page, context or browser has been closed` | Chrome 是否仍连接、是否误操作了连接页；执行 `tab-list` 后重新选择页面 |
| 截图保存失败 | 使用 `cd /d C:\Users\Q`，确认目标目录存在；优先使用相对当前 Windows 工作目录的路径 |

截图失败时至少保留：`snapshot` 文件、`console error` 输出、失败命令和当前 URL。只有在这些信息齐全后，才能判断是页面异步状态、引用过期、浏览器连接还是路径问题。

## 命令格式

```bash
# 所有命令通过 cmd.exe 调用，工作目录固定 C:\Users\Q
cmd.exe /c "cd /d C:\Users\Q && playwright-cli.cmd -s=chrome <命令>"
```

## 流程

```bash
# 1. 连接（每次会话先执行，需 Chrome 已打开且扩展已激活）
cmd.exe /c "cd /d C:\Users\Q && playwright-cli.cmd attach --extension=chrome"

# 2. 确认当前标签页（attach 后可能停留在连接页）
cmd.exe /c "cd /d C:\Users\Q && playwright-cli.cmd -s=chrome tab-list"

# 3. 操作（所有命令带 -s=chrome）
cmd.exe /c "cd /d C:\Users\Q && playwright-cli.cmd -s=chrome goto https://example.com"
cmd.exe /c "cd /d C:\Users\Q && playwright-cli.cmd -s=chrome snapshot"
cmd.exe /c "cd /d C:\Users\Q && playwright-cli.cmd -s=chrome click e15"
cmd.exe /c "cd /d C:\Users\Q && playwright-cli.cmd -s=chrome fill e5 \"内容\""

# 4. 断开
cmd.exe /c "cd /d C:\Users\Q && playwright-cli.cmd -s=chrome detach"
```

## 连接失败时

```bash
cmd.exe /c "cd /d C:\Users\Q && playwright-cli.cmd kill-all"
# 然后提示用户确认 Chrome 和扩展状态，重新 attach
```
