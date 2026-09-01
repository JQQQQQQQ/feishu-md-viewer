# Task 1：建立 Mermaid 预览交互失败测试基线报告

## 修改文件

- `tests/unit/mermaid-preview-only.test.tsx`
  - 增加底部热区触发工具栏显示的契约测试。
  - 增加按住空格进入画布平移状态的契约测试。
  - 增加点击遮罩关闭、点击画布内容不关闭及关闭后焦点回到预览按钮的契约测试。
  - 引入 `@testing-library/jest-dom/vitest`，使 `toHaveClass` 和 `toHaveFocus` 使用项目现有测试惯例正常执行。
- `tests/e2e/browser/preview.spec.ts`
  - 增加 Mermaid 预览工具栏按需显示、底部热区触发显示及点击遮罩关闭的浏览器场景。

## 测试命令与结果

### 单元测试

命令：

```bash
TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx
```

结果：失败（预期的 RED 基线）。共 6 个测试，3 个通过、3 个失败。现有预览和滚轮测试继续通过；新增测试分别因以下尚未实现的行为失败：

- 工具栏没有 `mermaid-preview-toolbar--hidden`，且没有底部热区契约。
- 按下空格后画布没有 `mermaid-preview-canvas--space-pan`。
- 点击遮罩后 dialog 没有关闭（因此焦点恢复断言也尚未达到）。

### E2E 测试

命令：

```bash
TMPDIR=/tmp npm run test:e2e -- tests/e2e/browser/preview.spec.ts -g "工具栏按需显示"
```

结果：失败，但本次未进入断言阶段。测试环境无法启动带扩展的 Chromium，`createBrowserContext` 报错：

```text
无法启动带扩展的 Chromium，请先执行 npm run build 和 npm run test:e2e:install；CI 请使用 xvfb-run。
browserType.launchPersistentContext: Target page, context or browser has been closed
... chrome exited with signal=SIGTRAP
```

## 未解决问题 / Concerns

- 业务代码尚未修改；三个新增单元测试保持失败，作为后续实现任务的 RED 基线。
- E2E 尚未验证到新增场景的 DOM 断言。运行前需要先执行项目要求的 `npm run build`、`npm run test:e2e:install`，并在支持 Chromium 扩展启动的环境中重跑；当前日志还显示 crashpad `setsockopt: Operation not permitted` 与 Chromium `SIGTRAP`。
- 工作区在任务开始时已有未跟踪的 `.superpowers/` 与 `docs/superpowers/plans/2026-08-28-mermaid-preview-experience.md`，本任务未将其纳入提交。

## Task 1 review 修正

根据 `task-1-review.md`，已修正两个测试文件：

- B2 增加 canvas 子结构、class 和 inline layout style 的前后快照比较，覆盖热区离开后的延迟隐藏、toolbar 自身 pointerEnter 保持显示及键盘操作显示。
- C2 增加普通 pointerDown 不阻止默认行为且不 capture、空格按下后 pointerDown 才阻止默认行为并 capture、pointerup/cancel 与 keyup 清理，以及 Shift+wheel 横向滚动和普通 wheel 不改变缩放。
- F1 改为异步等待关闭后的下一帧焦点恢复，并覆盖 canvas、内部 dialog、toolbar 点击不关闭，Esc 关闭和 overlay 本身点击关闭。
- E2E overlay 关闭点改为根据 dialog/overlay boundingBox 计算，避免依赖固定 viewport 坐标。

修正后单元测试命令仍为：

```bash
TMPDIR=/tmp npm test -- --run tests/unit/mermaid-preview-only.test.tsx
```

结果仍为预期 RED：6 个测试中旧测试 3 个通过，强化后的 3 个新增契约失败。E2E 未重跑；当前 Chromium 扩展启动失败的环境问题保持不变。

## C2 scoped re-review 修正

针对 scoped re-review 的剩余 Important，单元测试进一步为 canvas 注入可控的 client/scroll 尺寸和 scroll 属性 mock，新增确定性断言：

- 普通 wheel 增加 `scrollTop` 且保持 zoom 不变。
- Shift+wheel 增加 `scrollLeft`。
- 空格按下后的 pointer drag 同时改变 `scrollLeft` 与 `scrollTop`。
- 普通 pointerDown/pointerMove 不改变两个滚动值。

修正后运行同一单元命令，结果仍为 RED：旧测试 3 个通过，新增交互契约 3 个失败；业务代码保持未修改。报告本次更新不纳入修正 commit。
