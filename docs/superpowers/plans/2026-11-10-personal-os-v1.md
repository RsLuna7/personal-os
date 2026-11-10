# Personal OS v0.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做出个人 OS 第一版：一个部署在 GitHub Pages 上、可直接编辑的泳道时间线首页，数据存在浏览器本地。

**Architecture:** 纯前端单页应用。`data/` 是不依赖界面的数据层（校验、状态、撤销、存储、升级、备份）；`features/timeline/` 用纯函数做日期与像素换算、吸附、分行，再由 React 组件渲染和处理拖动；`features/editor/` 是各类编辑面板；`app/` 是外壳和路由。时间线自绘，不使用甘特图库。

**Tech Stack:** Vite、React 19、TypeScript（strict）、Tailwind CSS v4、shadcn/ui、`@radix-ui/colors`、Zustand、Zod、Vitest、React Testing Library、ESLint、Prettier、GitHub Actions、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-11-10-personal-os-v1-design.md`

## 开工前提

这三项不满足时不要开始 Task 1：

1. **能安装 npm 包。** 写计划时的工作环境拒绝了所有 `npm` 请求，本地只有 React 和 TypeScript，没有 Vite、Vitest、Tailwind 等。需要账号的网络设置允许安装依赖，并在新会话中生效。
2. **GitHub 上存在空的公开仓库 `RsLuna7/personal-os`，且会话对它有推送权限。** 当前环境里的 `gh` 令牌无效，无法代为创建仓库。
3. **仓库 Settings → Pages → Source 设为 "GitHub Actions"。**

## Global Constraints

- 仓库公开，不得提交任何真实个人数据；示例数据必须虚构。
- Pages 地址为 `https://rsluna7.github.io/personal-os/`，Vite `base` 固定为 `/personal-os/`。
- 路由用哈希（`#/timeline`、`#/calendar`、`#/modules`、`#/today`），默认进入 `#/timeline`。
- TypeScript 开启 `strict`；不使用 `any`。
- 不做深色模式；不使用阴影和渐变。
- 颜色只通过 `src/styles/tokens.css` 里的语义变量使用，组件里不写色值。取色对照见 Spec 第 4 节，原样照搬。
- 板块色带固定 8 条，顺序为 `iris, tomato, teal, amber, blue, grass, pink, bronze`。
- 字体为系统黑体；字重只用 400 和 500；字号只用 12、14、16、20 像素；间距为 8 像素的倍数；色块圆角 6 像素，面板圆角 12 像素。
- 泳道单行高 56 像素，色块高 32 像素。
- 过渡时长 150 到 250 毫秒、缓出；拖动过程不加过渡；`prefers-reduced-motion: reduce` 时关闭全部过渡。
- 所有日期按"整日数"（自 1970-01-01 起的 UTC 天数）计算，不使用本地时区运算，不引入日期库。
- 阶段和学期的 `end` 是不含当天的结束日期；界面上显示和输入的是含当天的结束日期（`end` 减一天）。
- `localStorage` 键名：`personal-os:data`、`personal-os:ui`、`personal-os:data:backup-v{n}`。
- 最小支持宽度 1024 像素；压缩后脚本总量不超过 200 KB。
- 界面文案为简体中文，使用本计划给出的原文。
- 提交信息用约定式提交；每个任务结束提交一次。

## Review Focus

Spec 没有明说、但使用者很可能遇到的五种情况。每条的测试已加到对应任务里。

1. **同时开着两个标签页编辑。** 期望：一个标签页保存后，另一个标签页自动载入新数据，而不是用旧数据覆盖。（Task 6）
2. **在面板里手填日期：结束早于开始，或日期被清空。** 期望：字段下方显示错误，不保存，原数据不变。（Task 10）
3. **色块比文字窄，或名称很长。** 期望：名称用省略号截断；宽度不足 24 像素时不显示名称，悬停提示里仍有完整名称。（Task 8）
4. **导入的文件结构合法但内容自相矛盾**：阶段指向不存在的板块、id 重复、开始不早于结束。期望：整体拒绝，现有数据不变。（Task 3、Task 7）
5. **页面开着过了零点，或系统处在夏令时切换日。** 期望：今天线移到新的一天；任何色块的位置和长度不因时区变化而偏移。（Task 4、Task 8）

---

## 文件结构

```
.github/workflows/ci.yml            代码检查、类型检查、测试、构建、体积检查
.github/workflows/deploy.yml        主分支构建并发布到 Pages
.github/pull_request_template.md
scripts/check-bundle-size.mjs       压缩后脚本总量上限 200 KB
src/main.tsx
src/app/App.tsx                     外壳：顶栏、路由出口、全局提示条
src/app/TopBar.tsx                  导航、添加、⋯ 菜单
src/app/useHashRoute.ts
src/app/PlaceholderPage.tsx         "待开发"
src/app/DataErrorScreen.tsx
src/data/schema.ts                  类型、Zod 校验、常量
src/data/store.ts                   Zustand 状态、修改动作、撤销重做
src/data/persistence.ts             读写 localStorage、自动保存、跨标签页同步
src/data/migrations.ts
src/data/backup.ts                  导出、导入、备份提醒
src/data/sample.ts
src/features/timeline/days.ts       ISODate 与整日数互转、今天
src/features/timeline/scale.ts      日与像素换算、缩放、预设
src/features/timeline/snap.ts       按周吸附、移动、拉伸
src/features/timeline/layout.ts     重叠分行、泳道高度
src/features/timeline/useViewport.ts
src/features/timeline/useToday.ts
src/features/timeline/Timeline.tsx
src/features/timeline/Ruler.tsx
src/features/timeline/LaneRow.tsx
src/features/timeline/PhaseBlock.tsx
src/features/timeline/MilestoneDot.tsx
src/features/timeline/EmptyState.tsx
src/features/timeline/useTimelineKeys.ts
src/features/editor/PhaseEditor.tsx
src/features/editor/MilestoneEditor.tsx
src/features/editor/LaneMenu.tsx
src/features/editor/AddMenu.tsx
src/features/editor/TermsDialog.tsx
src/features/editor/deleteToast.ts
src/styles/tokens.css
src/components/ui/*                 shadcn 生成的组件
```

测试文件与被测文件同目录，命名 `*.test.ts(x)`。

---

### Task 1: 脚手架、持续集成、发布

**Files:**
- Create: `package.json`、`vite.config.ts`、`tsconfig*.json`、`eslint.config.js`、`.prettierrc`、`index.html`、`src/main.tsx`、`src/app/App.tsx`、`src/app/App.test.tsx`、`src/test/setup.ts`、`.github/workflows/ci.yml`、`.github/workflows/deploy.yml`、`scripts/check-bundle-size.mjs`、`LICENSE`、`README.md`、`.gitignore`

**Interfaces:**
- Produces: npm 脚本 `dev`、`build`、`preview`、`lint`、`typecheck`、`test`（`vitest run`）、`check:size`。Vitest 环境为 `jsdom`，全局启用 `@testing-library/jest-dom`。路径别名 `@/` 指向 `src/`。

- [ ] **Step 1: 用 Vite 的 `react-ts` 模板在仓库根目录建项目**，`package.json` 的 `name` 为 `personal-os`，`version` 为 `0.1.0`。安装 Tailwind v4（`@tailwindcss/vite` 插件）、Vitest、jsdom、React Testing Library、`@testing-library/user-event`、`@testing-library/jest-dom`、ESLint、Prettier。各依赖用安装当时的稳定版。

- [ ] **Step 2: 写失败的冒烟测试** `src/app/App.test.tsx`

```tsx
it('renders the product name', () => {
  render(<App />)
  expect(screen.getByText('个人 OS')).toBeInTheDocument()
})
```

- [ ] **Step 3: 运行并确认失败**

Run: `npx vitest run src/app/App.test.tsx`
Expected: FAIL，找不到"个人 OS"

- [ ] **Step 4: 让 `App` 渲染产品名**，`vite.config.ts` 设置 `base: '/personal-os/'`。

- [ ] **Step 5: 写 `scripts/check-bundle-size.mjs`**：对 `dist/assets/*.js` 逐个 gzip 后求和，超过 `200 * 1024` 字节时以非零码退出并打印实际大小。

- [ ] **Step 6: 写两个工作流。** `ci.yml` 在 `push` 和 `pull_request` 时依次执行 `npm ci`、`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`npm run check:size`。`deploy.yml` 在 `main` 分支 `push` 时构建并用 `actions/upload-pages-artifact` 和 `actions/deploy-pages` 发布，权限为 `pages: write`、`id-token: write`。

- [ ] **Step 7: `LICENSE` 用 MIT 全文**，版权人写 `RsLuna7`；`README.md` 先写一行介绍和在线地址，Task 12 补全。

- [ ] **Step 8: 全部跑一遍**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run check:size`
Expected: 全部通过

- [ ] **Step 9: 提交并推送，确认网址可访问**

```bash
git add -A && git commit -m "chore: scaffold app with ci and pages deploy"
git push -u origin main
```
Expected: Actions 两个工作流都成功；`https://rsluna7.github.io/personal-os/` 显示"个人 OS"。

---

### Task 2: 样式基础、外壳、路由

**Files:**
- Create: `src/styles/tokens.css`、`src/app/useHashRoute.ts`、`src/app/TopBar.tsx`、`src/app/PlaceholderPage.tsx`、`src/app/TopBar.test.tsx`、`src/components/ui/*`
- Modify: `src/app/App.tsx`、`src/main.tsx`

**Interfaces:**
- Produces:
  - `type Route = 'timeline' | 'calendar' | 'modules' | 'today'`
  - `useHashRoute(): [Route, (r: Route) => void]`，未知或空哈希归为 `'timeline'`
  - CSS 语义变量：`--bg-page`、`--bg-subtle`、`--bg-panel`、`--border`、`--text`、`--text-muted`、`--today`；在带 `data-lane-color="<色带名>"` 的元素内可用 `--lane-fill`、`--lane-border`、`--lane-text`、`--lane-fill-past`、`--lane-border-past`、`--lane-dot`
  - 动效变量：`--dur-fast: 150ms`、`--dur-base: 200ms`、`--dur-slow: 250ms`、`--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`

- [ ] **Step 1: 初始化 shadcn/ui 并添加组件**：`button`、`popover`、`dropdown-menu`、`dialog`、`input`、`label`、`textarea`、`switch`、`tooltip`、`sonner`。安装 `@radix-ui/colors`。

- [ ] **Step 2: 写 `tokens.css`。** 引入 `sand`、`orange` 和 8 条板块色带的浅色样式表，按 Spec 第 4 节的对照表映射到上面的语义变量；把 shadcn 的主题变量指向这些语义变量，去掉深色主题块和所有阴影。加一条 `@media (prefers-reduced-motion: reduce)` 规则把全部过渡和动画时长置零。

- [ ] **Step 3: 写失败的测试** `src/app/TopBar.test.tsx`

```tsx
it('shows four nav items with timeline active by default', () => {
  render(<App />)
  expect(screen.getByRole('link', { name: '全局' })).toHaveAttribute('aria-current', 'page')
  for (const name of ['日历', '板块', '今日']) expect(screen.getByRole('link', { name })).toBeInTheDocument()
})
it('shows a placeholder for unbuilt views', async () => {
  render(<App />)
  await userEvent.click(screen.getByRole('link', { name: '日历' }))
  expect(screen.getByText('待开发')).toBeInTheDocument()
  expect(window.location.hash).toBe('#/calendar')
})
it('falls back to timeline for an unknown hash', () => {
  window.location.hash = '#/nope'
  render(<App />)
  expect(screen.getByRole('link', { name: '全局' })).toHaveAttribute('aria-current', 'page')
})
```

- [ ] **Step 4: 运行并确认失败**

Run: `npx vitest run src/app/TopBar.test.tsx`
Expected: FAIL

- [ ] **Step 5: 实现 `useHashRoute`、`TopBar`、`PlaceholderPage`，并在 `App` 里接上。** 顶栏高 56 像素，左侧产品名加导航，右侧留出"添加"和"⋯"的位置（后续任务填入）。占位页居中显示"待开发"。

- [ ] **Step 6: 运行并确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "feat: add design tokens, app shell and hash routing"
```

---

### Task 3: 数据结构和校验

**Files:**
- Create: `src/data/schema.ts`、`src/data/schema.test.ts`、`src/data/sample.ts`、`src/data/sample.test.ts`

**Interfaces:**
- Produces:
  - `CURRENT_SCHEMA_VERSION = 1`
  - `LANE_COLORS = ['iris','tomato','teal','amber','blue','grass','pink','bronze'] as const`；`type LaneColor`
  - `type ISODate = string`；`interface Lane | Phase | Milestone | Term | AppData`，字段与 Spec 第 5 节完全一致
  - `NAME_MAX = 40`、`NOTE_MAX = 2000`
  - `appDataSchema: z.ZodType<AppData>`
  - `createEmptyData(): AppData`
  - `createSampleData(today: ISODate): AppData`

- [ ] **Step 1: 写失败的测试** `src/data/schema.test.ts`

```ts
const base = createEmptyData()
const lane = { id: 'l1', name: '考研', color: 'iris', order: 0 }
const phase = { id: 'p1', laneId: 'l1', name: '基础', start: '2026-11-09', end: '2027-06-28', tentative: false, note: '' }

it('accepts empty data', () => expect(appDataSchema.safeParse(base).success).toBe(true))
it('accepts a valid lane with a phase', () =>
  expect(appDataSchema.safeParse({ ...base, lanes: [lane], phases: [phase] }).success).toBe(true))
it.each([
  ['phase pointing at a missing lane', { ...base, phases: [phase] }],
  ['phase whose start is not before end', { ...base, lanes: [lane], phases: [{ ...phase, end: phase.start }] }],
  ['duplicate ids', { ...base, lanes: [lane, lane] }],
  ['impossible date', { ...base, lanes: [lane], phases: [{ ...phase, start: '2026-02-30' }] }],
  ['unknown colour', { ...base, lanes: [{ ...lane, color: 'neon' }] }],
  ['name longer than 40', { ...base, lanes: [{ ...lane, name: 'x'.repeat(41) }] }],
  ['empty name', { ...base, lanes: [{ ...lane, name: '   ' }] }],
  ['term whose start is not before end', { ...base, terms: [{ id: 't1', name: '大三上', start: '2027-01-10', end: '2027-01-10' }] }],
])('rejects %s', (_, data) => expect(appDataSchema.safeParse(data).success).toBe(false))
```

`src/data/sample.test.ts`：

```ts
it('produces valid data around the given day', () => {
  const data = createSampleData('2026-11-10')
  expect(appDataSchema.safeParse(data).success).toBe(true)
  expect(data.lanes.length).toBeGreaterThanOrEqual(3)
  expect(data.phases.some((p) => p.tentative)).toBe(true)
  expect(data.milestones.length).toBeGreaterThanOrEqual(2)
  expect(data.terms.length).toBeGreaterThanOrEqual(2)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `npx vitest run src/data/schema.test.ts src/data/sample.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `schema.ts`。** 日期用正则加"能还原回同一字符串"的往返校验；名称先去首尾空白再校验 1 到 40 字；跨对象规则（引用存在、id 唯一、开始早于结束）用 `superRefine`。

- [ ] **Step 4: 实现 `sample.ts`。** 生成"示例考试 A""示例课程""示例实习"三个虚构板块，日期相对 `today` 计算，包含一个已结束的阶段、一个进行中的阶段、一个待确认阶段、两个节点、两段学期。不得出现真实学校、考试或个人信息。

- [ ] **Step 5: 运行并确认通过**

Run: `npx vitest run src/data`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add -A && git commit -m "feat: add data schema, validation and sample data"
```

---

### Task 4: 日期、换算、吸附、分行

**Files:**
- Create: `src/features/timeline/days.ts`、`scale.ts`、`snap.ts`、`layout.ts` 及各自的 `.test.ts`

**Interfaces:**
- Produces:
  - `days.ts`：`toDay(d: ISODate): number`、`fromDay(n: number): ISODate`、`todayISO(now?: Date): ISODate`（取本地日历日期）、`addDays(d: ISODate, n: number): ISODate`
  - `scale.ts`：`interface Scale { originDay: number; pxPerDay: number }`；`MIN_PX_PER_DAY = 0.5`、`MAX_PX_PER_DAY = 24`、`MONTH_TICK_MIN_PX_PER_DAY = 1.5`；`dayToX(s, day): number`；`xToDay(s, x): number`（向下取整）；`zoomAt(s, factor, anchorX): Scale`；`panBy(s, dx): Scale`；`type ZoomPreset = 'quarter' | 'year' | 'all'`；`presetScale(preset, viewportWidth, todayDay, range: { min: number; max: number } | null): Scale`
  - `snap.ts`：`WEEK = 7`；`snapToMonday(day): number`；`movePhase(startDay, endDay, deltaDays): { start: number; end: number }`；`resizePhase(startDay, endDay, edge: 'start' | 'end', targetDay): { start: number; end: number }`
  - `layout.ts`：`assignRows(phases: Pick<Phase,'id'|'start'|'end'>[]): Map<string, number>`；`laneHeight(rows: number): number`；`ROW_HEIGHT = 32`、`ROW_GAP = 8`、`LANE_PADDING = 12`

- [ ] **Step 1: 写失败的测试**

```ts
// days.test.ts
it('round-trips', () => expect(fromDay(toDay('2028-02-29'))).toBe('2028-02-29'))
it('counts days across a leap year', () => expect(toDay('2028-03-01') - toDay('2028-02-28')).toBe(2))
it('is unaffected by daylight saving', () => expect(toDay('2026-03-09') - toDay('2026-03-08')).toBe(1))
it('reads today from the local calendar', () =>
  expect(todayISO(new Date(2026, 10, 10, 23, 59))).toBe('2026-11-10'))

// scale.test.ts
const s = { originDay: 100, pxPerDay: 2 }
it('converts both ways', () => { expect(dayToX(s, 110)).toBe(20); expect(xToDay(s, 21)).toBe(110) })
it('keeps the anchored day fixed when zooming', () => {
  const z = zoomAt(s, 2, 40)
  expect(z.pxPerDay).toBe(4)
  expect(dayToX(z, 120)).toBeCloseTo(40)
})
it('clamps zoom', () => {
  expect(zoomAt(s, 1000, 0).pxPerDay).toBe(24)
  expect(zoomAt(s, 0.0001, 0).pxPerDay).toBe(0.5)
})
it('quarter preset shows 92 days starting 14 days before today', () => {
  const q = presetScale('quarter', 920, 1000, null)
  expect(q.pxPerDay).toBe(10); expect(q.originDay).toBe(986)
})
it('year preset shows 365 days starting 30 days before today', () => {
  const y = presetScale('year', 730, 1000, null)
  expect(y.pxPerDay).toBe(2); expect(y.originDay).toBe(970)
})
it('all preset fits the data range with 5% padding each side', () => {
  const a = presetScale('all', 1100, 1000, { min: 0, max: 1000 })
  expect(a.originDay).toBe(-50); expect(a.pxPerDay).toBe(1)
})
it('all preset falls back to year when there is no data', () =>
  expect(presetScale('all', 730, 1000, null)).toEqual(presetScale('year', 730, 1000, null)))

// snap.test.ts — 1970-01-05 (day 4) is a Monday
it('snaps to the nearest Monday', () => {
  expect(snapToMonday(4)).toBe(4); expect(snapToMonday(7)).toBe(4); expect(snapToMonday(8)).toBe(11)
})
it('moves a phase keeping its length', () => expect(movePhase(4, 32, 9)).toEqual({ start: 11, end: 39 }))
it('resizes the end and enforces one week minimum', () => {
  expect(resizePhase(4, 32, 'end', 20)).toEqual({ start: 4, end: 18 })
  expect(resizePhase(4, 32, 'end', 5)).toEqual({ start: 4, end: 11 })
  expect(resizePhase(4, 32, 'start', 31)).toEqual({ start: 25, end: 32 })
})

// layout.test.ts
it('keeps non-overlapping phases on one row', () => {
  const rows = assignRows([{ id: 'a', start: '2026-01-05', end: '2026-02-02' }, { id: 'b', start: '2026-02-02', end: '2026-03-02' }])
  expect([rows.get('a'), rows.get('b')]).toEqual([0, 0])
})
it('puts overlapping phases on separate rows', () => {
  const rows = assignRows([{ id: 'a', start: '2026-01-05', end: '2026-03-02' }, { id: 'b', start: '2026-02-02', end: '2026-04-06' }])
  expect([rows.get('a'), rows.get('b')]).toEqual([0, 1])
})
it('computes lane height', () => { expect(laneHeight(1)).toBe(56); expect(laneHeight(2)).toBe(96) })
```

- [ ] **Step 2: 运行并确认失败**

Run: `npx vitest run src/features/timeline`
Expected: FAIL

- [ ] **Step 3: 实现四个文件。** `toDay` 用 `Date.UTC`；`assignRows` 按开始日期排序后贪心放入第一个不冲突的行；空泳道高度按一行计算。

- [ ] **Step 4: 运行并确认通过**

Run: `npx vitest run src/features/timeline`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: add day math, scale, week snapping and row layout"
```

---

### Task 5: 状态和撤销重做

**Files:**
- Create: `src/data/store.ts`、`src/data/store.test.ts`

**Interfaces:**
- Consumes: Task 3 的类型、`createEmptyData`、`createSampleData`
- Produces: `useStore`（Zustand），状态与动作如下
  - 状态：`data: AppData`、`past: AppData[]`、`future: AppData[]`、`selection: { kind: 'phase' | 'milestone'; id: string } | null`
  - `HISTORY_LIMIT = 100`
  - `addLane(name?: string): string`（默认名"新板块"，颜色取第一条未被使用的色带，全用过则按顺序循环）
  - `updateLane(id, patch: Partial<Pick<Lane,'name'|'color'>>): void`
  - `moveLane(id, direction: -1 | 1): void`
  - `removeLane(id): void`（连同其阶段和节点）
  - `addPhase(input: { laneId: string; start: ISODate; end: ISODate; name?: string }): string`（默认名"新阶段"）
  - `updatePhase(id, patch: Partial<Omit<Phase,'id'>>): void`
  - `removePhase(id): void`
  - `addMilestone(input: { laneId: string; date: ISODate; name?: string }): string`（默认名"新节点"）
  - `updateMilestone(id, patch: Partial<Omit<Milestone,'id'>>): void`
  - `removeMilestone(id): void`
  - `setTerms(terms: Term[]): void`
  - `replaceData(data: AppData): void`（可撤销）
  - `hydrate(data: AppData): void`（不可撤销，清空历史，用于启动和跨标签页同步）
  - `markExported(at: string): void`（不进入历史）
  - `undo(): void`、`redo(): void`、`select(sel | null): void`

- [ ] **Step 1: 写失败的测试** `src/data/store.test.ts`（每个用例前 `hydrate(createEmptyData())`）

```ts
it('adds lanes with the first unused colour and sequential order', () => {
  const a = s().addLane('考研'); const b = s().addLane()
  expect(s().data.lanes.map((l) => [l.id, l.name, l.color, l.order])).toEqual([[a, '考研', 'iris', 0], [b, '新板块', 'tomato', 1]])
})
it('removes a lane together with its phases and milestones', () => {
  const l = s().addLane(); s().addPhase({ laneId: l, start: '2026-11-09', end: '2026-12-07' }); s().addMilestone({ laneId: l, date: '2026-12-19' })
  s().removeLane(l)
  expect([s().data.lanes, s().data.phases, s().data.milestones]).toEqual([[], [], []])
})
it('undoes and redoes', () => {
  const l = s().addLane(); s().updateLane(l, { name: '四级' })
  s().undo(); expect(s().data.lanes[0].name).toBe('新板块')
  s().redo(); expect(s().data.lanes[0].name).toBe('四级')
})
it('restores a removed lane with its children in one undo', () => {
  const l = s().addLane(); s().addPhase({ laneId: l, start: '2026-11-09', end: '2026-12-07' })
  s().removeLane(l); s().undo()
  expect(s().data.lanes).toHaveLength(1); expect(s().data.phases).toHaveLength(1)
})
it('clears redo after a new change', () => { s().addLane(); s().undo(); s().addLane(); expect(s().future).toEqual([]) })
it('does not record a no-op update', () => {
  const l = s().addLane(); const n = s().past.length
  s().updateLane(l, { name: '新板块' }); expect(s().past.length).toBe(n)
})
it('keeps at most 100 history entries', () => { for (let i = 0; i < 130; i++) s().addLane(); expect(s().past.length).toBe(100) })
it('swaps order when moving a lane and ignores moves past the edge', () => {
  const a = s().addLane(); const b = s().addLane()
  s().moveLane(b, -1); expect(s().data.lanes.find((l) => l.id === b)!.order).toBe(0)
  const n = s().past.length; s().moveLane(b, -1); expect(s().past.length).toBe(n)
  expect(s().data.lanes.find((l) => l.id === a)!.order).toBe(1)
})
it('rejects a patch that would make the data invalid', () => {
  const l = s().addLane(); const p = s().addPhase({ laneId: l, start: '2026-11-09', end: '2026-12-07' })
  expect(() => s().updatePhase(p, { end: '2026-11-09' })).toThrow()
  expect(s().data.phases[0].end).toBe('2026-12-07')
})
it('clears the selection when its target is removed', () => {
  const l = s().addLane(); const p = s().addPhase({ laneId: l, start: '2026-11-09', end: '2026-12-07' })
  s().select({ kind: 'phase', id: p }); s().removePhase(p); expect(s().selection).toBeNull()
})
it('hydrate replaces data and clears history', () => { s().addLane(); s().hydrate(createEmptyData()); expect([s().past, s().future]).toEqual([[], []]) })
it('markExported does not create an undo step', () => { const n = s().past.length; s().markExported('2026-11-10T00:00:00.000Z'); expect(s().past.length).toBe(n) })
```

- [ ] **Step 2: 运行并确认失败**

Run: `npx vitest run src/data/store.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `store.ts`。** 所有修改走同一个内部函数：计算新数据，用 `appDataSchema` 校验（失败则抛错且不改状态），与旧数据深比较相同则直接返回，否则压入 `past`、清空 `future`。id 用 `crypto.randomUUID()`。撤销或重做后若选中项已不存在则清空选中。

- [ ] **Step 4: 运行并确认通过**

Run: `npx vitest run src/data/store.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: add store with undo and redo"
```

---

### Task 6: 本地存储、版本升级、跨标签页同步

**Files:**
- Create: `src/data/migrations.ts`、`src/data/migrations.test.ts`、`src/data/persistence.ts`、`src/data/persistence.test.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: Task 5 的 `useStore`
- Produces:
  - `migrations.ts`：`class NewerVersionError extends Error`；`type Migration = (old: unknown) => unknown`；`runMigrations(raw: unknown, registry: Record<number, Migration>, target: number): { data: unknown; from: number }`；`migrations: Record<number, Migration>`（第一版为空）
  - `persistence.ts`：`DATA_KEY`、`UI_KEY`、`backupKey(v: number): string`；`type LoadResult = { status: 'empty' } | { status: 'ok'; data: AppData } | { status: 'corrupt'; raw: string; reason: string }`；`loadData(storage: Storage): LoadResult`；`saveData(storage: Storage, data: AppData): { ok: true } | { ok: false; reason: 'quota' | 'unavailable' }`；`interface UiPrefs { zoomPreset: ZoomPreset | 'custom'; pxPerDay: number | null; firstUsedAt: string }`；`loadUiPrefs(storage, now: Date): UiPrefs`；`saveUiPrefs(storage, prefs): void`；`SAVE_DEBOUNCE_MS = 300`；`startPersistence(storage: Storage, win: Window): { status: LoadResult; saveError: () => 'quota' | 'unavailable' | null; stop: () => void }`

- [ ] **Step 1: 写失败的测试**

```ts
// migrations.test.ts
const registry = { 0: (old: any) => ({ ...old, schemaVersion: 1, terms: [] }) }
it('runs migrations in order up to the target', () =>
  expect(runMigrations({ schemaVersion: 0, lanes: [] }, registry, 1)).toEqual({ data: { schemaVersion: 1, lanes: [], terms: [] }, from: 0 }))
it('leaves current data untouched', () => expect(runMigrations({ schemaVersion: 1 }, registry, 1).from).toBe(1))
it('refuses data from a newer version', () => expect(() => runMigrations({ schemaVersion: 2 }, registry, 1)).toThrow(NewerVersionError))
it('refuses data with no usable version', () => expect(() => runMigrations({}, registry, 1)).toThrow())

// persistence.test.ts — uses an in-memory Storage fake
it('reports empty when nothing is stored', () => expect(loadData(mem()).status).toBe('empty'))
it('round-trips saved data', () => { const st = mem(); saveData(st, sample); expect(loadData(st)).toEqual({ status: 'ok', data: sample }) })
it('reports corrupt for unparseable or invalid content and leaves it in place', () => {
  const st = mem({ [DATA_KEY]: '{oops' })
  expect(loadData(st).status).toBe('corrupt'); expect(st.getItem(DATA_KEY)).toBe('{oops')
})
it('reports quota when storage throws on write', () => expect(saveData(throwing('QuotaExceededError'), sample)).toEqual({ ok: false, reason: 'quota' }))
it('writes a backup of the old version before saving migrated data', () => { /* inject a v0 registry; expect backupKey(0) to hold the original string */ })
it('saves 300 ms after a change, and immediately on pagehide', () => { /* fake timers: no write at 299 ms, write at 300 ms; pagehide flushes */ })
it('never writes while the stored data is corrupt', () => { /* start with corrupt data, mutate store, advance timers: DATA_KEY unchanged */ })
it('adopts data written by another tab', () => {
  /* startPersistence; dispatch StorageEvent({ key: DATA_KEY, newValue: JSON.stringify(other) });
     expect(useStore.getState().data).toEqual(other); expect(useStore.getState().past).toEqual([]) */
})
it('ignores a storage event carrying invalid data', () => { /* store data unchanged */ })
```

- [ ] **Step 2: 运行并确认失败**

Run: `npx vitest run src/data/migrations.test.ts src/data/persistence.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `migrations.ts` 和 `persistence.ts`。** `startPersistence` 负责：读取并升级（升级前把原字符串写入 `backupKey(from)`），`hydrate` 进状态；订阅状态变化做 300 毫秒防抖保存；监听 `pagehide` 和 `visibilitychange`（变为隐藏时）立即保存；监听 `storage` 事件接收其他标签页的数据。读取结果为 `corrupt` 时不订阅保存。

- [ ] **Step 4: 在 `main.tsx` 启动时调用 `startPersistence(localStorage, window)`**，把返回的 `status` 交给 `App`（Task 11 用它显示错误页）。

- [ ] **Step 5: 运行并确认通过**

Run: `npx vitest run src/data`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add -A && git commit -m "feat: persist data locally with migrations and cross-tab sync"
```

---

### Task 7: 导出和导入

**Files:**
- Create: `src/data/backup.ts`、`src/data/backup.test.ts`

**Interfaces:**
- Consumes: `appDataSchema`、`runMigrations`、`NewerVersionError`
- Produces:
  - `IMPORT_MAX_BYTES = 5 * 1024 * 1024`、`REMINDER_DAYS = 30`
  - `exportFileName(day: ISODate): string`
  - `serialize(data: AppData): string`
  - `type ImportResult = { ok: true; data: AppData } | { ok: false; reason: 'too-large' | 'not-json' | 'invalid-shape' | 'newer-version' }`
  - `parseImport(text: string): ImportResult`
  - `IMPORT_ERROR_TEXT: Record<Exclude<ImportResult, { ok: true }>['reason'], string>`
  - `needsBackupReminder(lastExportAt: string | null, firstUsedAt: string, now: Date): boolean`
  - `downloadText(filename: string, text: string): void`

- [ ] **Step 1: 写失败的测试**

```ts
it('names the file by date', () => expect(exportFileName('2026-11-10')).toBe('personal-os-2026-11-10.json'))
it('round-trips', () => expect(parseImport(serialize(sample))).toEqual({ ok: true, data: sample }))
it.each([
  ['not-json', 'hello'],
  ['invalid-shape', JSON.stringify({ schemaVersion: 1, lanes: 'x' })],
  ['invalid-shape', JSON.stringify({ ...sample, phases: [{ ...sample.phases[0], laneId: 'missing' }] })],
  ['newer-version', JSON.stringify({ ...sample, schemaVersion: 2 })],
  ['too-large', 'x'.repeat(5 * 1024 * 1024 + 1)],
])('rejects with %s', (reason, text) => expect(parseImport(text)).toEqual({ ok: false, reason }))
it('reminds after 30 days without an export', () => {
  const now = new Date('2026-12-15T00:00:00Z')
  expect(needsBackupReminder(null, '2026-11-10T00:00:00Z', now)).toBe(true)
  expect(needsBackupReminder('2026-12-01T00:00:00Z', '2026-11-10T00:00:00Z', now)).toBe(false)
  expect(needsBackupReminder(null, '2026-12-01T00:00:00Z', now)).toBe(false)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `npx vitest run src/data/backup.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `backup.ts`。** `serialize` 用两个空格缩进。错误文案原文：

| reason | 文案 |
|---|---|
| `too-large` | 文件超过 5 MB，无法导入。 |
| `not-json` | 这不是有效的备份文件。 |
| `invalid-shape` | 备份文件内容不完整或已损坏，现有数据未改动。 |
| `newer-version` | 这个备份来自更新的版本。刷新页面后再试。 |

- [ ] **Step 4: 运行并确认通过**

Run: `npx vitest run src/data/backup.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: add backup export and import"
```

---

### Task 8: 时间线渲染

**Files:**
- Create: `src/features/timeline/useViewport.ts`、`useToday.ts`、`Timeline.tsx`、`Ruler.tsx`、`LaneRow.tsx`、`PhaseBlock.tsx`、`MilestoneDot.tsx`、`EmptyState.tsx`、`Timeline.test.tsx`
- Modify: `src/app/App.tsx`、`src/app/TopBar.tsx`

**Interfaces:**
- Consumes: Task 4 的全部函数、Task 5 的 `useStore`、Task 6 的 `loadUiPrefs`/`saveUiPrefs`
- Produces:
  - `useToday(): number`（今天的整日数；每 60 秒和页面重新可见时重新计算）
  - `useViewport(): { scale: Scale; width: number; preset: ZoomPreset | 'custom'; setPreset(p: ZoomPreset): void; zoomAt(factor: number, anchorX: number): void; panBy(dx: number): void; goToToday(): void; containerRef: RefObject<HTMLDivElement> }`
  - `LABEL_COLUMN_WIDTH = 112`、`MIN_LABEL_WIDTH = 24`
  - DOM 约定（后续任务和测试依赖）：
    - 阶段：`data-testid="phase-{id}"`，`role="button"`，`tabIndex=0`，`data-past`、`data-tentative`、`data-selected` 取 `"true"`/`"false"`，`style.transform = translateX({x}px)`，`style.width = {w}px`，`style.top` 由所在行决定，外层泳道元素带 `data-lane-color`
    - 节点：`data-testid="milestone-{id}"`，`role="button"`，`tabIndex=0`
    - 今天线：`data-testid="today-line"`
    - 泳道：`data-testid="lane-{id}"`，`style.height`
    - 学期带每段：`data-testid="term-{id}"`

- [ ] **Step 1: 写失败的测试** `Timeline.test.tsx`（用固定的今天 `2026-11-10` 和固定视口宽度；先 `hydrate` 测试数据）

```tsx
it('shows the empty state with two actions when there is no data', () => {
  expect(screen.getByText('开始规划你的时间线')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '从空白开始' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '载入示例' })).toBeInTheDocument()
})
it('loads the sample from the empty state', async () => {
  await userEvent.click(screen.getByRole('button', { name: '载入示例' }))
  expect(useStore.getState().data.lanes.length).toBeGreaterThanOrEqual(3)
})
it('renders lanes in order with their names', () => { /* names appear top to bottom by order */ })
it('positions a phase from its dates', () => {
  // scale { originDay: toDay('2026-11-02'), pxPerDay: 2 }; phase 2026-11-09 → 2026-12-07
  expect(el.style.transform).toBe('translateX(14px)'); expect(el.style.width).toBe('56px')
})
it('marks finished phases as past and others not', () => { /* end <= today → data-past="true" */ })
it('marks tentative phases', () => { /* data-tentative="true" */ })
it('stacks overlapping phases and grows the lane', () => { /* second phase style.top differs; lane style.height === '96px' */ })
it('draws the today line at today', () => { /* transform matches dayToX(scale, today) */ })
it('hides the label of a phase narrower than 24px but keeps it in the tooltip', async () => { /* Review Focus 3 */ })
it('truncates long names with an ellipsis', () => { /* label element has the truncate class; title holds the full name */ })
it('shows term segments when terms exist and none otherwise', () => {})
it('shows month ticks only at 1.5 px per day or more', () => {})
it('shows countdown text for a milestone on hover', async () => {
  // milestone 2026-12-19, today 2026-11-10 → '还有 39 天'; a milestone on 2026-11-01 → '已过 9 天'; today → '就是今天'
})
it('switches zoom presets and remembers the choice', async () => { /* click 一年 → UI prefs zoomPreset === 'year' */ })
it('moves the today line after midnight', () => {
  // Review Focus 5: fake timers at 2026-11-10 23:59:30, advance 60 s → line at 2026-11-11
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `npx vitest run src/features/timeline/Timeline.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现各组件。**
  - 布局：左侧 112 像素固定列放板块名，右侧为可横向平移的画布；标尺固定在顶部。阶段和节点是画布内绝对定位的 HTML 元素，用 `transform` 定位。
  - 阶段悬停提示内容：名称、`开始 – 结束（含当天）`、`共 N 周`（不足整周时写 `共 N 天`）。
  - 已结束判定：`toDay(end) <= today`。
  - 顶栏加入缩放三档分段按钮（`近三个月`、`一年`、`全部`）和 `回到今天` 按钮。
  - 首次进入和点击"回到今天"时，把今天放在画布左起四分之一处。
  - 空状态标题"开始规划你的时间线"，说明"添加板块和阶段，一眼看清现在处在哪里。"；"从空白开始"调用 `addLane()`，"载入示例"调用 `replaceData(createSampleData(todayISO()))`。
  - 泳道列表末尾有一行"添加板块"按钮。

- [ ] **Step 4: 运行并确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: render the swimlane timeline"
```

---

### Task 9: 拖动、缩放、平移

**Files:**
- Modify: `src/features/timeline/PhaseBlock.tsx`、`LaneRow.tsx`、`Timeline.tsx`、`useViewport.ts`
- Create: `src/features/timeline/drag.test.tsx`

**Interfaces:**
- Consumes: `movePhase`、`resizePhase`、`snapToMonday`、`xToDay`、`useStore`
- Produces:
  - 阶段两端的拉伸手柄：`data-testid="phase-{id}-handle-start"` 和 `-handle-end`，宽 8 像素
  - 拖动提示：`data-testid="drag-hint"`，文本格式 `11月9日 – 12月6日 · 4 周`
  - `DRAG_THRESHOLD_PX = 4`、`NEW_PHASE_WEEKS = 4`

- [ ] **Step 1: 写失败的测试** `drag.test.tsx`（`pxPerDay = 2`；用 `fireEvent.pointerDown/pointerMove/pointerUp` 带 `clientX`）

```tsx
it('moves a phase by whole weeks on drag and records one undo step', () => {
  // phase 2026-11-09 → 2026-12-07; drag body +18px (9 days) → 2026-11-16 → 2026-12-14
  // past.length grows by exactly 1
})
it('shows live dates while dragging and removes the hint on release', () => {
  // during the drag above: drag-hint text is '11月16日 – 12月13日 · 4 周'
})
it('does not commit when the pointer returns to the start', () => { /* past.length unchanged */ })
it('treats a movement under 4px as a click, not a drag', () => { /* no change; selection set to the phase */ })
it('resizes from the end handle with a one-week minimum', () => {
  // drag end handle -60px → end snaps so the phase is exactly 7 days long
})
it('resizes from the start handle', () => {})
it('cancels the drag on Escape', () => { /* dates unchanged, hint gone */ })
it('creates a four-week phase on double-click in empty lane space and selects it', () => {
  // double-click at the x of 2026-11-18 → start 2026-11-16, end 2026-12-14, name '新阶段', selection is the new phase
})
it('does not create a phase when double-clicking an existing one', () => {})
it('zooms around the pointer on ctrl+wheel and switches preset to custom', () => {})
it('pans on horizontal wheel and on dragging empty space', () => {})
```

- [ ] **Step 2: 运行并确认失败**

Run: `npx vitest run src/features/timeline/drag.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现。** 拖动期间的预览位置保存在组件内部状态里，松手时只调用一次 `updatePhase`，因此一次拖动是一步撤销。调用 `setPointerCapture` 前先判断方法是否存在。拖动中的元素关闭过渡；松手后用 `--dur-fast` 过渡到吸附位置。`Ctrl+滚轮` 每格缩放系数 1.1，以指针位置为锚点。

- [ ] **Step 4: 运行并确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: drag to move and resize phases, zoom and pan"
```

---

### Task 10: 编辑面板和菜单

**Files:**
- Create: `src/features/editor/PhaseEditor.tsx`、`MilestoneEditor.tsx`、`LaneMenu.tsx`、`AddMenu.tsx`、`TermsDialog.tsx`、`deleteToast.ts`、`editor.test.tsx`
- Modify: `src/features/timeline/Timeline.tsx`、`LaneRow.tsx`、`Ruler.tsx`、`src/app/TopBar.tsx`、`src/app/App.tsx`

**Interfaces:**
- Consumes: `useStore` 的全部动作、`addDays`
- Produces:
  - `showDeleteToast(name: string): void`：显示"已删除「{name}」"，带"撤销"按钮，5000 毫秒后消失；点击"撤销"调用 `undo()`；出现任何新的修改时提示条立即消失
  - `<PhaseEditor phaseId anchor onClose />`、`<MilestoneEditor milestoneId anchor onClose />`、`<LaneMenu laneId />`、`<AddMenu />`、`<TermsDialog open onOpenChange />`

- [ ] **Step 1: 写失败的测试** `editor.test.tsx`

```tsx
it('opens the phase editor on click with the name, inclusive end date and lane filled in', async () => {
  // phase end '2026-12-07' → the 结束 field shows 2026-12-06
})
it('saves the name on Enter and on blur', async () => {})
it('saves an edited end date as exclusive', async () => { /* type 2026-12-20 → stored end '2026-12-21' */ })
it('shows an error and does not save when the end is before the start', async () => {
  // Review Focus 2: message '结束日期不能早于开始日期'; stored dates unchanged
})
it('shows an error and does not save when a date is cleared', async () => { /* message '请填写日期' */ })
it('falls back to 未命名 when the name is cleared', async () => {})
it('toggles tentative', async () => {})
it('moves a phase to another lane', async () => {})
it('deletes without a confirm dialog and offers undo for 5 seconds', async () => {
  // click 删除 → phase gone, toast '已删除「基础」'; click 撤销 → phase back
})
it('dismisses the delete toast when another change happens', async () => {})
it('edits a milestone name, date and lane', async () => {})
it('adds a phase, a milestone and a lane from the add menu', async () => {
  // 阶段: first lane, start = Monday of the current week, 4 weeks; 节点: first lane, today; 板块: '新板块' in rename mode
})
it('disables 阶段 and 节点 in the add menu when there are no lanes', async () => {})
it('renames, recolours, reorders and deletes a lane from its menu', async () => {})
it('edits terms in the dialog as a single undo step', async () => {})
it('rejects overlapping or reversed terms', async () => { /* '学期时间不能重叠' / '结束日期不能早于开始日期' */ })
it('opens the editor with the name selected right after creating a phase by double-click', async () => {})
```

- [ ] **Step 2: 运行并确认失败**

Run: `npx vitest run src/features/editor`
Expected: FAIL

- [ ] **Step 3: 实现。**
  - 阶段面板字段及标签：`名称`、`开始`、`结束`、`板块`、`待确认`、`备注`，底部 `删除`。没有"保存"按钮：名称和备注在失焦或回车时提交，其余字段在改变时提交；每次提交是一步撤销。
  - 节点面板字段：`名称`、`日期`、`板块`、`备注`、`删除`。
  - 日期字段用 `<input type="date">`。
  - 板块菜单项：`重命名`、颜色（8 个色块）、`上移`、`下移`、`删除板块`。点击板块名打开。
  - 添加菜单项：`阶段`、`节点`、`板块`。
  - 学期对话框标题"编辑学期"，每行 `名称`、`开始`、`结束`、删除按钮，下方"添加学期"，底部"完成"和"取消"。点击"完成"时一次 `setTerms`。点击学期带打开。
  - 面板出现时淡入并上浮 4 像素，时长 `--dur-base`。
  - 阶段和节点在新建时淡入、删除时淡出，时长 200 毫秒。

- [ ] **Step 4: 运行并确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: add editors for phases, milestones, lanes and terms"
```

---

### Task 11: 键盘、⋯ 菜单、出错界面

**Files:**
- Create: `src/features/timeline/useTimelineKeys.ts`、`src/features/timeline/keys.test.tsx`、`src/app/DataErrorScreen.tsx`、`src/app/shell.test.tsx`
- Modify: `src/app/App.tsx`、`src/app/TopBar.tsx`、`src/features/timeline/Timeline.tsx`

**Interfaces:**
- Consumes: `useStore`、`startPersistence` 的返回值、`parseImport`、`serialize`、`exportFileName`、`downloadText`、`needsBackupReminder`、`IMPORT_ERROR_TEXT`、`showDeleteToast`
- Produces: `useTimelineKeys(viewport): void`

- [ ] **Step 1: 写失败的测试**

```tsx
// keys.test.tsx — a phase 2026-11-09 → 2026-12-07 is selected
it('moves the selection by a week with arrow keys, without re-snapping', async () => { /* → gives 2026-11-16 → 2026-12-14 */ })
it('moves a milestone by a week with arrow keys', async () => {})
it('changes the end by a week with shift+arrow and keeps the one-week minimum', async () => {})
it('deletes the selection with Delete and shows the undo toast', async () => {})
it('opens the editor with Enter and closes it with Escape', async () => {})
it('clears the selection with Escape when no editor is open', async () => {})
it('undoes with ctrl+z and redoes with ctrl+shift+z', async () => {})
it('jumps to today with T', async () => {})
it('ignores shortcuts while typing in a field', async () => { /* Delete inside the name input does not remove the phase */ })
it('reaches every phase and milestone with Tab and shows a visible focus ring', async () => {})

// shell.test.tsx
it('exports the current data and records the export time', async () => { /* downloadText called with 'personal-os-2026-11-10.json'; lastExportAt set */ })
it('imports a valid file, replaces the data and offers undo', async () => { /* toast '已导入备份' with 撤销 */ })
it('shows the reason and keeps the data when the import is invalid', async () => {})
it('shows a dot on the menu button when a backup is overdue', () => {})
it('clears all data with undo available', async () => {})
it('shows the error screen instead of the app when stored data is corrupt', () => {
  // title '数据读取失败'; buttons '下载原始数据' and '导入备份'; DATA_KEY untouched
})
it('recovers from the error screen by importing a backup', async () => {})
it('shows a warning banner when saving fails', () => {
  // text '浏览器存储不可用或已满，修改可能无法保存。请立即导出备份。'
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `npx vitest run src/features/timeline/keys.test.tsx src/app/shell.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现。**
  - 快捷键在 `window` 上监听 `keydown`；事件目标是 `input`、`textarea`、`select` 或可编辑元素时忽略。同时支持 `Ctrl` 和 `Meta`。
  - 方向键对阶段是起止各加减 7 天；对节点是日期加减 7 天。
  - "⋯"菜单项依次为：`导出备份`、`导入备份`、`编辑学期`、`载入示例`、`清空数据`。按钮的无障碍名称为"更多"。备份逾期时按钮右上角有一个 6 像素圆点，并带 `aria-label="更多，建议导出备份"`。
  - 清空数据调用 `replaceData(createEmptyData())` 并显示"已清空数据"加"撤销"。
  - 错误页说明："浏览器里保存的数据无法读取。原数据没有被改动，可以先下载下来，再从备份恢复。"下载的文件名为 `personal-os-corrupt-{日期}.txt`。导入成功后把数据写回并进入正常界面。
  - 焦点环用 2 像素的 `--text` 色外描边，偏移 2 像素。

- [ ] **Step 4: 运行并确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: add keyboard shortcuts, backup menu and error states"
```

---

### Task 12: 文档、验收、发布 v0.1.0

**Files:**
- Modify: `README.md`
- Create: `CHANGELOG.md`、`.github/pull_request_template.md`、`docs/screenshot.png`

- [ ] **Step 1: 补全 `README.md`**：一句话介绍、截图、在线地址、功能列表、"数据存在哪里以及如何备份"、键盘快捷键表、本地开发命令、目录说明、许可证。截图用示例数据。

- [ ] **Step 2: 写 `CHANGELOG.md`**，采用"新增、变更、修复"分组，记录 `0.1.0` 的内容。

- [ ] **Step 3: 写 PR 模板**，包含四栏：`改了什么`、`为什么`、`如何验证`、`截图（界面改动必填）`。在仓库里建两个 Issue 标签：`体验问题` 和 `新功能`。

- [ ] **Step 4: 全量检查**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run check:size`
Expected: 全部通过，体积检查打印的数值不超过 200 KB

- [ ] **Step 5: 在浏览器里逐条走一遍 Spec 第 10 节的验收清单**

Run: `npm run preview`，打开提示的本地地址。
Expected: 清单每一项都能完成。另外检查：拖动 50 个阶段的示例时无明显卡顿；系统开启"减少动态效果"后没有过渡动画；窗口宽度 1024 像素时布局不破。发现问题就回到对应任务修复并补测试，再重跑 Step 4。

- [ ] **Step 6: 提交、推送、打标签**

```bash
git add -A && git commit -m "docs: add readme, changelog and pr template"
git push
git tag v0.1.0 && git push origin v0.1.0
```
Expected: Actions 全部成功；在线地址上重复 Step 5 中"刷新后数据仍在"和"导出再导入"两项，结果一致。
