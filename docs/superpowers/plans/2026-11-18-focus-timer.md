# 专注计时 Implementation Plan

**Goal:** 新增专注计时：番茄钟和正计时、标签、记录和统计；首页角落一个常驻小计时，另有「专注」页。

**Spec:** `docs/superpowers/specs/2026-11-18-focus-timer-design.md`

**Architecture:** 记录进 `AppData.focusSessions`（schema v6 + 迁移）；计时中的状态单独存 `personal-os:focus-run`，不进备份。计时和统计是纯函数（`timer.ts`、`stats.ts`），状态在 `focusStore.ts`，常驻的 `FocusRuntime` 负责刷新、补算、标题和提醒。

## Global Constraints

- 只用时间戳算时间，不累加；`now` 作为参数传进纯函数，测试里不靠真实时钟。
- 补算出来的记录 id 由开始时刻决定，多标签页不会记两次。
- 颜色只用 tokens 和 `data-lane-color`；不做暗色模式；动效遵守“减少动态效果”。
- 完成前跑：`npm run lint && npm run typecheck && npm test && npm run build && npm run check:size`，脚本 gzip ≤ 200 KB。

## Tasks

- [x] **1. 数据层**：`FocusSession` 类型和校验、`v5ToV6` 迁移、`addFocus` / `updateFocus` / `removeFocus`、示例数据；已有测试里写死的版本号改成 6。
- [x] **2. 计时逻辑 `timer.ts`**：已用/剩余、暂停继续、`advance` 补算、`finishSession`、不足 1 分钟不保存。
- [x] **3. 统计 `stats.ts`**：今日记录、每天总分钟数、热力图、本周按标签、历史标签、标签颜色、时长格式。
- [x] **4. 状态 `focusStore.ts`**：开始、暂停、继续、完成、放弃、跳过休息、下一轮、`tick`；写入存储并能恢复；`storage` 事件跟随；设置。
- [x] **5. 提醒 `alerts.ts` 和 `FocusRuntime`**：系统通知、提示音、标题、陈旧事件不提醒。
- [x] **6. 界面**：`StartForm` / `TagInput` / `RunView`、首页 `FocusWidget`、`FocusPage`（今日记录、本周、热力图、设置）、导航和路由。
- [x] **7. 文档和发布**：CHANGELOG、README、PR、合并后自动部署到 GitHub Pages。

## Review Focus

1. 关掉页面很久再打开：专注记录落在它该结束的时刻、休息从那一刻起算，而不是从重新打开起算。
2. 暂停中的专注永远不会到点；暂停时间不计入专注时长，记录通过 `focusMs ≤ endAt − startAt` 的校验。
3. 旧版本（v1–v5）备份导入后都能升到 v6；v6 的备份在 v5 的旧页面里会被拒绝并提示刷新。
4. 两个标签页同时开着：同一轮只记一条，另一个标签页的暂停、放弃会同步过来。
5. 脚本总量 199.4 KB，离上限只剩不到 1 KB。
