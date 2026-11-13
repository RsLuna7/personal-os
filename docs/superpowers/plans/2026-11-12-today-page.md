# 今日页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `#/today` 占位页做成三栏的今日页：收件箱 | 今天 | 打卡，并新增“习惯”数据。

**Architecture:** 数据层加 `Habit`（schema v5 + 迁移 + store 操作）；纯函数放 `src/features/today/`（`habits.ts`、`inbox.ts`），组件也放这个目录；“今天”栏复用首页的 `homeTodos`，勾选停留逻辑从 `TodoBoard` 抽成 hook 共用。拖拽用指针事件 + 栏的 `getBoundingClientRect` 命中测试，阈值复用 `DRAG_THRESHOLD_PX`。

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4、zustand、zod、lucide-react、vitest + Testing Library。

**Spec:** `docs/superpowers/specs/2026-11-12-today-page-design.md`

## Global Constraints

- 所有界面文字用中文，和 spec 用词一致（“收件箱”“今天”“打卡”“未安排”“全部移到今天”“今天不用打 N”“+ 新习惯”“去今日 →” 等）。
- 每个 store 操作是一步撤销（走 `commit`）；没有实际变化时不 commit。
- 颜色只用 tokens（`--bg-card`、`--text-muted`、`--danger`、`--shadow-card` …）和 `data-lane-color`；不写死色值。
- 星期：1 = 周一 … 7 = 周日。日期用整日数 `day`（`toDay`/`fromDay`），星期由 `day` 推算。
- 三栏断点 `lg`（1024）；整个应用最小宽度 768。
- 完成前跑：`npm run lint && npm run typecheck && npm test && npm run build && npm run check:size`，脚本 gzip ≤ 200 KB。
- 提交信息结尾：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Review Focus

1. 用户导入一份 v4 的旧备份文件 → 应自动迁移成 v5、习惯为空，不报错。（Task 1 测试导入路径）
2. 习惯挂的板块被删除 → 习惯留下、`laneId` 变 `null`，数据仍通过校验。（Task 1）
3. 今天是周日（星期 7）→ `isDue` 对 `weekdays: [7]` 返回 true；跨周的 `streak` 正确。（Task 2）
4. 今天创建的习惯 → 最近 7 天里只有今天是“该打”，其他 6 格是“不用打”，连续记录 0 不显示。（Task 2）
5. 拖动距离不到 4px 松手 → 当作点击（打开编辑），不改日期。（Task 6）

---

## File Structure

| 文件 | 职责 |
| --- | --- |
| `src/data/schema.ts`（改） | `Habit` 类型和 zod 校验，`AppData.habits`，版本 5 |
| `src/data/migrations.ts`（改） | `v4ToV5` |
| `src/data/store.ts`（改） | `addHabit`/`updateHabit`/`toggleCheck`/`removeHabit`；删板块时清习惯的 `laneId` |
| `src/data/sample.ts`（改） | 示例习惯 |
| `src/features/today/habits.ts` | `weekdayOf`、`isDue`、`streak`、`recentDays` |
| `src/features/today/inbox.ts` | `inboxGroups` |
| `src/features/home/useLinger.ts` | 从 `TodoBoard` 抽出的“勾掉后停留”hook |
| `src/features/today/TodayTodoRow.tsx` | 今日页通用待办行（勾选、色条、标题、悬停操作、可拖） |
| `src/features/today/TodayColumn.tsx` | 中间“今天”栏 |
| `src/features/today/InboxColumn.tsx` | 左边收件箱 |
| `src/features/today/useColumnDrag.ts` | 栏间拖拽 |
| `src/features/today/HabitColumn.tsx`、`HabitRow.tsx` | 打卡栏 |
| `src/features/editor/HabitEditor.tsx` | 习惯编辑面板 |
| `src/features/today/TodayPage.tsx` | 页头 + 三栏布局 + 编辑面板挂载 |
| `src/app/App.tsx`（改） | `today` 路由渲染 `TodayPage` |
| `src/features/home/TodoBoard.tsx`（改） | 链接改“去今日 →”，改用 `useLinger` |

---

### Task 1: 习惯的数据层（schema v5、迁移、store、示例）

**Files:**
- Modify: `src/data/schema.ts`, `src/data/migrations.ts`, `src/data/store.ts`, `src/data/sample.ts`, `src/features/editor/editorStore.ts`
- Test: `src/data/schema.test.ts`, `src/data/migrations.test.ts`, `src/data/store.test.ts`, `src/data/backup.test.ts`

**Interfaces:**
- Produces:
  - `interface Habit { id: string; name: string; laneId: string | null; weekdays: number[]; checks: ISODate[]; createdAt: string }`
  - `AppData.habits: Habit[]`，`CURRENT_SCHEMA_VERSION = 5`
  - store：`addHabit(input?: { name?: string; weekdays?: number[]; laneId?: string | null }): string`（默认名“新习惯”、`[1..7]`、`null`）；`updateHabit(id, patch: Partial<Pick<Habit, 'name' | 'weekdays' | 'laneId'>>): void`；`toggleCheck(id: string, date: ISODate): void`；`removeHabit(id: string): void`
  - `Editing['kind']` 增加 `'habit'`

- [ ] **Step 1: 写失败的测试**
  - schema：合法习惯通过；`weekdays: []`、`[0]`、`[8]`、`[1,1]` 拒绝；`checks` 有重复或非法日期拒绝；`laneId` 指向不存在的板块拒绝；习惯 id 和待办 id 重复拒绝。
  - migrations：`migrations[4]({schemaVersion:4, todos:[], …})` 得到 `schemaVersion: 5, habits: []` 且通过 `appDataSchema`；已有 `habits` 时不覆盖。
  - store：`addHabit()` 返回 id，习惯 `weekdays` 为 `[1,2,3,4,5,6,7]`；`toggleCheck(id,'2026-11-12')` 两次后 `checks` 回到 `[]`，中间为 `['2026-11-12']`；先打 11-12 再打 11-10 后 `checks` 为升序 `['2026-11-10','2026-11-12']`；`updateHabit` 把 `weekdays` 存成升序去重；`updateHabit(id,{weekdays:[]})` 不生效；`removeHabit` 后 `undo()` 恢复；`removeLane` 后挂在上面的习惯 `laneId === null`；每个操作只增加一步撤销。
  - backup：含习惯的数据 `serialize` 再解析后习惯相同；一份 v4 的导出文本能导入并得到 `habits: []`。
  - sample：`createSampleData` 结果通过校验且 `habits.length >= 2`。

- [ ] **Step 2: 跑测试确认失败**
  Run: `npx vitest run src/data`
  Expected: FAIL（`habits` 未定义等）

- [ ] **Step 3: 实现**
  - schema：`habitSchema`（`weekdays: z.array(z.number().int().min(1).max(7)).min(1)` + superRefine 查重；`checks: z.array(dateSchema)` 查重），加入 id 查重和 laneId 检查；`createEmptyData` 加 `habits: []`。
  - migrations：`v4ToV5` 返回 `{ ...data, schemaVersion: 5, habits: Array.isArray(data.habits) ? data.habits : [] }`，登记 `4: v4ToV5`，更新上方注释。备份由 persistence 现有逻辑按版本号写 `backup-v4`，确认现有测试覆盖。
  - store：按待办操作的写法实现四个操作；`toggleCheck` 对不存在的 id 不做事；`removeLane` 一并把习惯的 `laneId` 清空。
  - sample：两三个习惯，例如“背单词”（每天，近几天大部分打了）、“健身”（`[1,3,5]`）、挂一个示例板块的一个，`checks` 用 `addDays(today, -n)` 生成，`createdAt` 早于最早的打卡。
  - editorStore：`kind` 加 `'habit'`。

- [ ] **Step 4: 跑测试确认通过**
  Run: `npx vitest run src/data && npm run typecheck`
  Expected: PASS（typecheck 若因其他文件的 `AppData` 字面量缺 `habits` 报错，逐个补上）

- [ ] **Step 5: Commit** — `feat: add habits to the data model (schema v5)`

---

### Task 2: 习惯的纯函数

**Files:**
- Create: `src/features/today/habits.ts`
- Test: `src/features/today/habits.test.ts`

**Interfaces:**
- Consumes: `Habit`（Task 1）
- Produces:
  - `weekdayOf(day: number): number` — 1..7，周一为 1
  - `isDue(habit: Habit, day: number): boolean` — `weekdays` 含 `weekdayOf(day)` 且 `day >= toDay(createdAt 的本地日期)`
  - `type DayMark = 'done' | 'missed' | 'off'`；`recentDays(habit: Habit, today: number, count = 7): { day: number; mark: DayMark }[]` — 从旧到新，最后一个是今天；打了卡的日子永远是 `'done'`（即使不该打）；不该打且没打是 `'off'`；该打没打是 `'missed'`（今天没打也是 `'missed'`）
  - `streak(habit: Habit, today: number): number`
  - `RECENT_DAYS = 7`

- [ ] **Step 1: 写失败的测试**（用 `toDay('2026-11-12')`，那天是周四）
  - `weekdayOf(toDay('2026-11-09')) === 1`，`weekdayOf(toDay('2026-11-15')) === 7`。
  - `isDue`：`weekdays:[7]` 在 11-15 为 true、11-12 为 false；`createdAt` 为 11-12 时 11-11 为 false。
  - `streak`：每天习惯，打了 11-10、11-11、11-12 → 3；打了 11-10、11-11，今天没打 → 2；打了 11-12、11-10（漏 11-11）→ 1；`weekdays:[1,3,5]` 打了 11-09、11-11 且今天（周四）不用打 → 2；创建于 11-11、打了 11-11 → 1（不往创建日前数）；什么都没打 → 0。
  - `recentDays`：创建于今天的每天习惯 → 前 6 个 `'off'`、最后 `'missed'`；打了今天 → 最后 `'done'`；`weekdays:[1,3,5]` 创建很久前、都没打 → 11-06(五) 到 11-12 依次 `missed, off, off, missed, off, missed, off`。

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/features/today/habits.test.ts`，FAIL

- [ ] **Step 3: 实现**。`streak`：`checked = new Set(checks.map(toDay))`；从 `day = today` 开始，若今天该打且没打则从 `today - 1` 开始；往前走，遇到 `isDue` 为 false 的跳过，遇到创建日之前停止，打了 +1，该打没打停止。`createdAt` 取 ISO 时间的本地日期（用 `todayISO(new Date(createdAt))` 再 `toDay`）。

- [ ] **Step 4: 跑测试确认通过** — PASS

- [ ] **Step 5: Commit** — `feat: compute habit due days, streaks and recent marks`

---

### Task 3: 收件箱分组

**Files:**
- Create: `src/features/today/inbox.ts`
- Test: `src/features/today/inbox.test.ts`

**Interfaces:**
- Produces:
  - `INBOX_DAYS = 7`
  - `interface InboxGroup { key: string; title: string; todos: Todo[] }`
  - `inboxGroups(todos: Todo[], today: number, keep?: ReadonlySet<string>): InboxGroup[]` — 第一组 `key: 'unscheduled', title: '未安排'`（为空时省略），之后每个有待办的日子一组，`key` 为 ISO 日期；标题：`today+1` → “明天”，`today+2` → “后天”，其余 `` `${formatDay(day)} ${周X}` ``（formatDay 现有格式 + 空格 + “周一…周日”）。组内按 `createdAt`、`id` 排序。`keep` 里的已完成待办仍显示（停留用）。

- [ ] **Step 1: 写失败的测试**：未安排的排第一；今天、过期、`today+8` 的不出现；`today+7` 出现；已完成不出现，除非在 `keep` 里；标题“明天”“后天”和第三天的“11月15日 周日”（按 `formatDay` 实际格式写断言）；空输入返回 `[]`。

- [ ] **Step 2:** `npx vitest run src/features/today/inbox.test.ts` → FAIL
- [ ] **Step 3:** 实现。
- [ ] **Step 4:** → PASS
- [ ] **Step 5: Commit** — `feat: group inbox todos by day`

---

### Task 4: 待办行组件和“今天”栏

**Files:**
- Create: `src/features/home/useLinger.ts`, `src/features/today/TodayTodoRow.tsx`, `src/features/today/TodayColumn.tsx`
- Modify: `src/features/home/TodoBoard.tsx`（改用 `useLinger`，行为不变）
- Test: `src/features/today/TodayColumn.test.tsx`；现有 `TodoBoard` 测试必须仍通过

**Interfaces:**
- Consumes: `homeTodos`（`src/features/home/todayTodos.ts`），`LINGER_MS`，store 的 `toggleTodo`/`updateTodo`/`removeTodo`/`moveTodos`/`addTodo`，`openEditor('todo', id)`，`showDeleteToast`
- Produces:
  - `useLinger(): { lingering: ReadonlySet<string>; toggle: (todo: Todo) => void }` — 把 `TodoBoard` 里的 timers/withOut 逻辑原样搬过来
  - `TodayTodoRow` props：`{ todo: Todo; lanes: Lane[]; onToggle(todo): void; meta?: ReactNode; actions: ReactNode; onPointerDown?: (event, todo) => void; dragging?: boolean }`。根元素 `li` 带 `data-testid={`todo-${id}`}`（`TodoEditor` 靠它定位）、`data-lane-color`、`data-done`、`className="todo-item group …"`；`actions` 放在 `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100` 的容器里。标题是 `button`，点击 `openEditor('todo', id)`。
  - `TodayColumn` props：`{ todos: Todo[]; lanes: Lane[]; today: number; dropActive?: boolean; onRowPointerDown? }`，`section` 带 `data-testid="today-column"` 和 `data-drop-zone="today"`

- [ ] **Step 1: 写失败的测试**（`TodayColumn.test.tsx`，用 store 注入数据，fake timers）
  - 显示“过期 1”“今天 2”，不限 5 条（放 7 条今天的待办都显示）。
  - “全部移到今天”后过期待办日期为今天。
  - 点“+ 添加今天的待办”，输入“买牛奶”回车 → 新增一条今天的待办，输入框清空且仍聚焦；空输入回车不新增；Esc 收起。
  - 行操作按钮：`推到明天`（`aria-label="推到明天「标题」"`）→ 日期为明天；`移回收件箱` → `date === null`；`删除` → 待办消失，`undo()` 后回来。
  - 勾选后 `LINGER_MS` 内仍在原位，之后出现在“已完成 1”下。
  - 没有待办时显示“今天没有待办”。

- [ ] **Step 2:** `npx vitest run src/features/today/TodayColumn.test.tsx` → FAIL
- [ ] **Step 3:** 实现 `useLinger`、`TodayTodoRow`、`TodayColumn`；`TodoBoard` 改用 `useLinger`。图标用 lucide `ArrowRightIcon`（推到明天）、`InboxIcon`（移回收件箱）、`Trash2Icon`（删除），按钮带 `aria-label`。
- [ ] **Step 4:** `npx vitest run src/features/today src/features/home` → PASS
- [ ] **Step 5: Commit** — `feat: add the today column with add, defer and delete`

---

### Task 5: 收件箱栏

**Files:**
- Create: `src/features/today/InboxColumn.tsx`
- Test: `src/features/today/InboxColumn.test.tsx`

**Interfaces:**
- Consumes: `inboxGroups`（Task 3），`TodayTodoRow`、`useLinger`（Task 4）
- Produces: `InboxColumn` props `{ todos: Todo[]; lanes: Lane[]; today: number; dropActive?: boolean; onRowPointerDown? }`，`section` 带 `data-testid="inbox-column"`、`data-drop-zone="inbox"`

- [ ] **Step 1: 写失败的测试**：显示“未安排”“明天”组；“→ 今天”（`aria-label="移到今天「标题」"`）后待办日期为今天且从收件箱消失；勾选后停留再消失；全空时显示“收件箱是空的”。
- [ ] **Step 2:** → FAIL
- [ ] **Step 3:** 实现。
- [ ] **Step 4:** → PASS
- [ ] **Step 5: Commit** — `feat: add the inbox column`

---

### Task 6: 栏间拖拽

**Files:**
- Create: `src/features/today/useColumnDrag.ts`
- Test: `src/features/today/useColumnDrag.test.tsx`

**Interfaces:**
- Consumes: `exceedsThreshold`（`src/features/calendar/drag.ts`），store `updateTodo`
- Produces:
  - `type DropZone = 'today' | 'inbox'`
  - `zoneAtPoint(zones: { zone: DropZone; rect: GridRect }[], x: number, y: number): DropZone | null`（纯函数，导出供测试）
  - `useColumnDrag({ today: number, enabled: boolean }): { dragging: { todo: Todo; from: DropZone; x: number; y: number } | null; over: DropZone | null; onRowPointerDown: (event: React.PointerEvent, todo: Todo, from: DropZone) => void }`
  - 落点规则：`from` 为 `inbox`、落在 `today` → `updateTodo(id,{date: fromDay(today)})`；`from` 为 `today`、落在 `inbox` → `{date: null}`；其他不做事。没超过阈值就松手 → 不阻止后续 click（标题按钮照常打开编辑）。
  - 命中区域用 `document.querySelectorAll('[data-drop-zone]')` 的 `getBoundingClientRect`。`enabled` 为 false（窄于 `lg`，用 `matchMedia('(min-width: 1024px)')`）时 `onRowPointerDown` 什么都不做。拖动中渲染一个跟随指针的半透明行（`pointer-events-none fixed`）。

- [ ] **Step 1: 写失败的测试**：`zoneAtPoint` 命中、未命中；hook 测试里模拟 `pointerdown`→`pointermove`(10px)→`pointerup`，mock 两栏的 `getBoundingClientRect`，断言日期变化；移动 2px 松手不改日期；落回原栏不改。
- [ ] **Step 2:** → FAIL
- [ ] **Step 3:** 实现（窗口级 `pointermove`/`pointerup` 监听，参照 `useCalendarDrag.ts` 的写法）。
- [ ] **Step 4:** → PASS
- [ ] **Step 5: Commit** — `feat: drag todos between the inbox and today`

---

### Task 7: 打卡栏和习惯编辑面板

**Files:**
- Create: `src/features/today/HabitRow.tsx`, `src/features/today/HabitColumn.tsx`, `src/features/editor/HabitEditor.tsx`
- Test: `src/features/today/HabitColumn.test.tsx`, `src/features/editor/habitEditor.test.tsx`

**Interfaces:**
- Consumes: `isDue`、`recentDays`、`streak`、`RECENT_DAYS`（Task 2），store 习惯操作（Task 1），`EditorPopover`、`NameField`、`LaneSelect`、`cleanName`、`showDeleteToast`（`src/features/editor`）
- Produces:
  - `HabitColumn` props `{ habits: Habit[]; lanes: Lane[]; today: number }`，`data-testid="habit-column"`
  - `HabitRow` 根元素 `data-testid={`habit-${id}`}`；今天的勾选框 `role="checkbox"`、`aria-label="打卡「名字」"`（不用打的习惯没有这个框）；7 个格子是按钮，`aria-label="${formatDay(day)} ${已打卡|未打卡|不用打}"`、`data-mark`；连续记录文字 `${n} 天`，0 时不渲染
  - `HabitEditor({ habitId, anchor, onClose, selectName })`，定位 `[data-testid="habit-${id}"]`；字段：名称、频率（“每天”开关 + 七个星期切换按钮“一 二 三 四 五 六 日”）、板块、删除

- [ ] **Step 1: 写失败的测试**
  - 列表只含今天该打的；不该打的收在“今天不用打 1”按钮下，展开后可见且没有今天的勾选框。
  - 勾“打卡「背单词」”→ `checks` 含今天，连续记录数字 +1。
  - 点 6 天前的格子 → 补打成功（`data-mark="done"`）；再点取消。
  - 只渲染 7 个格子（更早的不可改，由此保证）。
  - “+ 新习惯”→ 新增并打开编辑面板（`openEditor('habit', id, true)`）。
  - 编辑面板：取消“每天”后只选“一”“三”→ `weekdays` 为 `[1,3]`；取消最后一个已选星期时不生效（至少一天）；“删除”后习惯消失、出现撤销提示。
  - 没有习惯时显示“还没有习惯”。

- [ ] **Step 2:** → FAIL
- [ ] **Step 3:** 实现。格子：`done` 填板块色（`data-lane-color` + 复用 `todo-bar` 那套 CSS 变量，没有板块用中性色），`missed` 空心描边，`off` 降低不透明度。
- [ ] **Step 4:** → PASS
- [ ] **Step 5: Commit** — `feat: add the habit column and habit editor`

---

### Task 8: 今日页组装、路由、首页链接

**Files:**
- Create: `src/features/today/TodayPage.tsx`
- Modify: `src/app/App.tsx`（`route === 'today'` 渲染 `<TodayPage />`），`src/features/home/TodoBoard.tsx`（`href="#/today"`，文字“去今日 →”，注释同步），`src/features/home/todayTodos.ts`（注释），`src/app/TopBar.test.tsx`（不再断言“待开发”）
- Test: `src/features/today/TodayPage.test.tsx`；`src/features/home` 现有测试更新链接断言

**Interfaces:**
- Consumes: Task 4–7 的组件，`useToday`，`weekLabel`、`isHolidayName`（`src/features/timeline/ticks.ts`），`useEditorStore`、`closeEditor`、`TodoEditor`、`HabitEditor`
- Produces: `TodayPage()`

- [ ] **Step 1: 写失败的测试**
  - 页头显示日期和星期（如“11月12日 周四”）；在学期内显示“第 N 周”，学期外不显示。
  - 进度：今天 2 条待办中完成 1 条、3 个该打的习惯打了 1 个 → “待办 1/2 · 打卡 1/3”。过期待办不计入。
  - 三栏都在；DOM 顺序为 今天 → 打卡 → 收件箱（窄屏顺序），`lg` 下用 `lg:order-*` 把收件箱放到第一列。
  - 打开待办编辑：点标题后出现“编辑待办”面板；点习惯名出现“编辑习惯”面板。
  - 首页待办板块链接为“去今日 →”，`href="#/today"`。
- [ ] **Step 2:** → FAIL
- [ ] **Step 3:** 实现。布局：`grid gap-4 lg:grid-cols-[1fr_1.4fr_1fr]`，外层 `mx-auto max-w-[1280px] px-6 py-6`，与首页一致；页面自己纵向滚动（`overflow-y-auto`）。
- [ ] **Step 4:** `npm test` → 全部 PASS
- [ ] **Step 5: Commit** — `feat: build the today page and link to it from home`

---

### Task 9: 全量检查和浏览器验证

**Files:** `CHANGELOG.md`（加一条“今日页：收件箱、今天、打卡”）

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test && npm run build && npm run check:size` → 全部通过，gzip ≤ 200 KB
- [ ] **Step 2:** 启动 dev server，先备份浏览器 localStorage 再载入示例数据；在 768、1024、1440 宽度下截图检查：无横向滚动；1024 以上三栏并排、收件箱在左；768 时上下排且顺序为 今天 → 打卡 → 收件箱；拖拽、打卡、补打、编辑面板都能用；控制台无报错。结束后恢复用户 localStorage。
- [ ] **Step 3: Commit** — `docs: note the today page in the changelog`
