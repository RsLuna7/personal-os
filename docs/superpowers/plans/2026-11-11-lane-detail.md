# 板块详情页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做出顶栏“板块”这一页：左侧板块列表，右侧所选板块的备注、资料链接、阶段与节点列表；数据版本升到 2。

**Architecture:** 备注和链接直接放在 `Lane` 上，数据升到版本 2，沿用现有的升级和备份机制。路由从“页面名”扩展为“页面名加可选参数”（`#/modules/<id>`）。新页面放在 `features/lane/`，排序分组和网址校验是纯函数；编辑面板、板块菜单、撤销全部复用现有的。

**Tech Stack:** React 19、TypeScript（strict）、Tailwind CSS v4、Zustand、Zod、Vitest + React Testing Library（与现有项目一致）。

**Spec:** `docs/superpowers/specs/2026-11-11-lane-detail-design.md`（上层：`2026-11-10-personal-os-v1-design.md`）

## Global Constraints

- 数据版本 `CURRENT_SCHEMA_VERSION = 2`；`AppData.schemaVersion` 类型为 `2`。
- `Lane` 新增 `note: string`（最多 `NOTE_MAX` = 2000 字，纯文本）和 `links: Link[]`（最多 50 条）。
- `Link = { id: string; title: string; url: string }`，标题 1 到 `NAME_MAX` = 40 字；网址只允许 `http:` 和 `https:`。
- 链接一律用 `target="_blank"` 加 `rel="noopener noreferrer"` 打开；应用不抓取、不预览网址。
- 路由：`#/modules` 和 `#/modules/<板块编号>`；参数无效时选排在第一位的板块。
- 本页不启用时间线快捷键（方向键移动选中项、`Delete`、`T`）；`Ctrl+Z`、`Ctrl+Shift+Z` 保持可用。
- 视觉沿用全局页：画布底色 `--bg-canvas`、白色卡片加 `--shadow-card`、标题用 `font-serif`；最小宽度 1024 像素。
- 本版不做：Markdown 备注、链接图标或预览、阶段级链接、拖动排序、完成勾选、手机端。
- 打包后脚本压缩后不超过 200 KB；文字对比度达到 WCAG AA。
- 提交信息用约定式提交；先写失败的测试，再写实现；测试里用 `vi.useFakeTimers({ toFake: ['Date'] })` 并把系统时间固定在 2026-11-10 12:00，路由用 `window.location.hash` 设置（与现有测试一致）。
- 每个任务结束时 `npm run lint && npm run typecheck && npm test` 全部通过。

## Review Focus

1. **危险协议的链接**（`javascript:`、`data:`、`file:`）：在界面输入时被拒绝（Task 9），在导入的备份里整体被拒绝（Task 2），store 也不接受（Task 3）。
2. **超长备注或标题**：绝不能写进 store，否则下次打开校验失败、整个应用进入“数据读取失败”页（Task 3 store 拒绝，Task 8 界面阻止保存并保留已输入内容）。
3. **选中的板块消失**（删除、撤销、网址里是旧编号）：回到第一个板块，不报错，没有板块时显示空状态（Task 4、7）。
4. **版本 1 的本地数据和备份**：本地升级前有 `backup-v1`，导入旧备份自动升级，升级后通过新校验（Task 2）。
5. **已结束的行正被选中或编辑**时，折叠不能把它藏起来（Task 10）。

---

## 文件结构

```
src/
  data/
    links.ts            新：normalizeLinkUrl、isHttpUrl
    schema.ts           改：Link、Lane.note/links、版本 2
    migrations.ts       改：登记 1→2
    store.ts            改：updateLane 补丁、addLink/updateLink/removeLink、addLane 默认值
    sample.ts           改：示例板块补备注和链接
  app/
    useHashRoute.ts     改：路由加参数
    TopBar.tsx          不改（“板块”高亮靠 route 判断）
    App.tsx             改：modules 路由挂 LanePage
  features/
    editor/
      useUndoKeys.ts    新：撤销重做快捷键，从 useTimelineKeys 拆出
      AddMenu.tsx       改：导出 addPhaseToLane / addMilestoneToLane
    timeline/
      useTimelineKeys.ts 改：撤销重做改为调用 useUndoKeys
    lane/               新
      select.ts         resolveLaneId、laneHref
      items.ts          buildLaneItems、状态文字
      LanePage.tsx      页面：两栏、选中、空状态、编辑面板挂载
      LaneSidebar.tsx   左侧板块列表
      LaneHeader.tsx    标题、菜单、摘要
      NoteCard.tsx      备注
      LinksCard.tsx     资料链接
      ItemsCard.tsx     阶段与节点
    home/
      LaneOverview.tsx  改：卡片变链接
```

---

### Task 1: 网址校验

**Files:**
- Create: `src/data/links.ts`
- Test: `src/data/links.test.ts`

**Interfaces:**
- Produces:
  - `normalizeLinkUrl(text: string): string | null`：去首尾空白；空串返回 `null`；没有 `://` 且不以 `javascript:`、`data:`、`file:`、`vbscript:`、`mailto:`、`tel:`、`blob:`、`about:` 开头（不分大小写）时补 `https://`；再用 `new URL` 解析，协议不是 `http:` 或 `https:` 返回 `null`；通过则返回 `url.href`。
  - `isHttpUrl(text: string): boolean`：`new URL(text)` 能解析且协议是 `http:` 或 `https:`（不做补全，供 Zod 校验已存的网址）。

- [ ] **Step 1: 写失败的测试** `links.test.ts`，用表格驱动，断言：
  - `normalizeLinkUrl('example.com')` → `'https://example.com/'`
  - `'example.com/a?b=1#c'` → `'https://example.com/a?b=1#c'`
  - `'  https://a.com/x  '` → `'https://a.com/x'`
  - `'http://a.com'` → `'http://a.com/'`
  - `'example.com:8080/x'` → `'https://example.com:8080/x'`
  - 以下全部返回 `null`：`''`、`'   '`、`'javascript:alert(1)'`、`'JAVASCRIPT:alert(1)'`、`'data:text/html,<b>x</b>'`、`'file:///c:/x'`、`'ftp://a.com'`、`'hello world'`、`'mailto:a@b.com'`
  - `isHttpUrl('https://a.com')` 为真；`isHttpUrl('a.com')`、`isHttpUrl('javascript:1')`、`isHttpUrl('')` 为假。
- [ ] **Step 2: 运行确认失败**：`npx vitest run src/data/links.test.ts`，预期因找不到模块失败。
- [ ] **Step 3: 实现** 上面两个函数。
- [ ] **Step 4: 运行确认通过**：同上命令，预期全部通过。
- [ ] **Step 5: 提交**：`git add src/data/links.* && git commit -m "feat: add link url validation"`

---

### Task 2: 数据版本 2（结构、升级、示例、旧测试）

**Files:**
- Modify: `src/data/schema.ts`、`src/data/migrations.ts`、`src/data/sample.ts`
- Modify（测试，机械改动）：`src/data/schema.test.ts`、`src/data/backup.test.ts`、`src/data/persistence.test.ts`、`src/data/migrations.test.ts`、`src/data/sample.test.ts`、`src/app/shell.test.tsx`、`src/features/editor/editor.test.tsx`、`src/features/home/summary.test.ts`、`src/features/timeline/{drag,exit,keys,Timeline}.test.tsx`
- Test: `src/data/schema.test.ts`、`src/data/migrations.test.ts`、`src/data/backup.test.ts`、`src/data/persistence.test.ts`

**Interfaces:**
- Consumes: `isHttpUrl`（Task 1）。
- Produces（后续任务依赖）：
  - `export interface Link { id: string; title: string; url: string }`
  - `Lane` 增加 `note: string; links: Link[]`
  - `export const LINKS_MAX = 50`
  - `CURRENT_SCHEMA_VERSION = 2`，`AppData.schemaVersion: 2`
  - `migrations[1]`：`(old: unknown) => unknown`

- [ ] **Step 1: 写失败的测试**
  - `schema.test.ts`：合法的带备注和链接的板块通过；以下各自被拒绝：`note` 超过 2000 字；`links` 超过 50 条；链接网址为 `javascript:alert(1)`；链接标题为空或超过 40 字；链接 `id` 与某个阶段 `id` 重复；缺少 `note` 或 `links`。
  - `migrations.test.ts`：`migrations[1]` 把 `{ schemaVersion: 1, lanes: [{ id, name, color, order }], ... }` 变成 `schemaVersion: 2` 且每个板块 `note: ''`、`links: []`，并且结果通过 `appDataSchema`；`lanes` 不是数组时原样透传（交给校验去拒绝）。
  - `backup.test.ts`：导入版本 1 的备份文本成功且结果是版本 2；导入含 `url: 'javascript:alert(1)'` 链接的版本 2 备份返回 `{ ok: false, reason: 'invalid-shape' }`；导出再导入内容一致。
  - `persistence.test.ts`：用默认升级表，本地存的是版本 1 数据时，`loadData` 返回版本 2 的数据，`backupKey(1)` 保存着原文，`DATA_KEY` 里是版本 2。
- [ ] **Step 2: 运行确认失败**：`npx vitest run src/data`，预期新增的用例失败。
- [ ] **Step 3: 实现**
  - `schema.ts`：加 `Link`、`LINKS_MAX`；`linkSchema`（`id` 非空，`title` 用 `nameSchema`，`url` 为 `z.string().max(2048).refine(isHttpUrl, '网址必须以 http 或 https 开头')`）；`laneSchema` 加 `note: noteSchema`、`links: z.array(linkSchema).max(LINKS_MAX)`；`superRefine` 里的全局 `id` 唯一检查把所有链接也算进去；版本改为 2。
  - `migrations.ts`：登记 `1: v1ToV2`，给每个板块补 `{ note: '', links: [], ...lane }` 并把 `schemaVersion` 设为 2；更新文件里的注释。
  - `sample.ts`：三个板块各加一段虚构备注和一到两条链接（网址用 `https://example.com/...`）。
- [ ] **Step 4: 修正已有测试**（这些改动是为了让旧测试在新结构下仍表达原意，不是放宽）：
  - 所有测试文件里写死的板块字面量加上 `note: '', links: []`（共 12 个文件，`grep -rn "color: '" src` 能列全）。
  - 原来拿 `schemaVersion: 2` 当“比应用新”的三处（`backup.test.ts`、`persistence.test.ts`、`schema.test.ts` 的“wrong schema version”）改成 `3`。
  - `persistence.test.ts` 里自定义升级表的那个用例，升级表加上 `1: migrations[1]`，最终版本断言改为 2，`backupKey(0)` 的断言保持不变。
- [ ] **Step 5: 运行**：`npm run typecheck && npx vitest run`，预期全部通过。
- [ ] **Step 6: 提交**：`git add -A && git commit -m "feat: schema v2 with lane notes and links"`

---

### Task 3: store 的备注和链接操作

**Files:**
- Modify: `src/data/store.ts`
- Test: `src/data/store.test.ts`

**Interfaces:**
- Consumes: `normalizeLinkUrl`（Task 1）、`Link`、`LINKS_MAX`、`NOTE_MAX`、`NAME_MAX`（Task 2）。
- Produces:
  - `updateLane(id: string, patch: Partial<Pick<Lane, 'name' | 'color' | 'note'>>): void`：`patch.note` 超过 `NOTE_MAX` 时整个调用不生效。
  - `addLink(laneId: string, input: { title: string; url: string }): string`：返回新链接 `id`；标题去空白后为空或超长、网址 `normalizeLinkUrl` 为 `null`、板块不存在、该板块已有 50 条时返回 `''` 且不改数据。写入的网址是规范化后的。
  - `updateLink(laneId: string, linkId: string, patch: Partial<Pick<Link, 'title' | 'url'>>): void`：同样的校验，不合法则不生效。
  - `removeLink(laneId: string, linkId: string): void`
  - `addLane` 创建的板块带 `note: ''` 和 `links: []`。
  - 以上都是一次 `commit`，即撤销历史里的一步。

- [ ] **Step 1: 写失败的测试**：`addLink` 返回非空 `id`、网址被规范化（`'example.com'` → `'https://example.com/'`）、数据里多一条；`addLink` 对 `'javascript:alert(1)'`、空标题、41 字标题、第 51 条各返回 `''` 且 `data` 引用不变；`updateLink` 改标题和网址，非法网址不生效；`removeLink`；`updateLane` 改备注成功，2001 字的备注不生效；上述每个成功操作 `undo` 后恢复、`redo` 后重做；`removeLane` 后该板块的链接一并消失；`addLane` 的新板块 `note === ''` 且 `links` 为空数组。
- [ ] **Step 2: 运行确认失败**：`npx vitest run src/data/store.test.ts`。
- [ ] **Step 3: 实现** 上述签名；链接 `id` 用文件里已有的 `newId()`。
- [ ] **Step 4: 运行确认通过**：同上命令。
- [ ] **Step 5: 提交**：`git commit -am "feat: lane note and link actions in the store"`

---

### Task 4: 路由参数和板块选择

**Files:**
- Modify: `src/app/useHashRoute.ts`
- Create: `src/features/lane/select.ts`
- Test: `src/app/useHashRoute.test.ts`（新）、`src/features/lane/select.test.ts`（新）

**Interfaces:**
- Produces:
  - `parseHash(hash: string): { route: Route; param: string | null }`：`#/modules/abc` → `{ route: 'modules', param: 'abc' }`；参数做 `decodeURIComponent`（解码失败当作没有参数）；只有 `modules` 路由保留参数，其他路由 `param` 恒为 `null`；未知路由回到 `home`。
  - `routeHref(route: Route, param?: string): string`：`routeHref('modules', 'a b')` → `'#/modules/a%20b'`；其他路由忽略 `param`。
  - `useHashRoute(): [Route, (route: Route, param?: string) => void, string | null]`：第三项是当前参数。
  - `resolveLaneId(lanes: Lane[], param: string | null): string | null`：按 `order` 排序；`param` 指向存在的板块就返回它，否则返回第一个板块的 `id`，没有板块返回 `null`。
  - `laneHref(id: string): string`：与 `routeHref('modules', id)` 结果一致。

- [ ] **Step 1: 写失败的测试**：`parseHash` 的上述各行为（含 `'#/modules'`、`'#/modules/'`、`'#/home/x'`、`'#/modules/%E0%A4%A'` 解码失败、`'#/nope'`）；`routeHref` 的编码；`resolveLaneId` 的四种情形（有效参数、无效参数、`null` 参数、空列表）和按 `order` 而非数组顺序取第一个；`laneHref(id)` 等于 `routeHref('modules', id)`。再加一个组件级用例：渲染 `App` 并把 `window.location.hash` 设为 `'#/modules/x'` 时，顶栏“板块”是高亮的。
- [ ] **Step 2: 运行确认失败**：`npx vitest run src/app src/features/lane`。
- [ ] **Step 3: 实现**，`App.tsx` 先把第三项取出来但暂不使用。
- [ ] **Step 4: 运行确认通过**：同上命令，并跑 `npx vitest run`（确认旧的路由测试不受影响）。
- [ ] **Step 5: 提交**：`git commit -am "feat: hash route parameter and lane selection"`

---

### Task 5: 阶段与节点的合并排序分组

**Files:**
- Create: `src/features/lane/items.ts`
- Test: `src/features/lane/items.test.ts`

**Interfaces:**
- Consumes: `Phase`、`Milestone`、`toDay`（`features/timeline/days`）。
- Produces:
  - `type PhaseStatus = 'in-progress' | 'tentative' | 'upcoming' | 'ended'`
  - `const PHASE_STATUS_TEXT: Record<PhaseStatus, string>`：`进行中`、`待确认`、`未开始`、`已结束`
  - ```ts
    type LaneItem =
      | { kind: 'phase'; id: string; sortDay: number; phase: Phase; status: PhaseStatus }
      | { kind: 'milestone'; id: string; sortDay: number; milestone: Milestone }
    ```
  - `buildLaneItems(laneId: string, phases: Phase[], milestones: Milestone[], today: number): { current: LaneItem[]; ended: LaneItem[] }`
  - 规则：只取该板块的；阶段 `end <= today` 为 `ended`，否则 `tentative` 优先于时间判断，再按 `start <= today` 分 `in-progress`、`upcoming`；节点日期早于 `today` 算已结束，当天不算。两组各自按 `sortDay`（阶段开始日、节点日期）升序，同一天阶段在前、节点在后，再按 `id` 稳定排序。

- [ ] **Step 1: 写失败的测试**：各状态的边界（阶段 `end === today` 为已结束、`start === today` 为进行中；待确认且已过期为已结束；节点当天在 `current`、前一天在 `ended`）；混排顺序；同一天阶段在节点前；同一天同类型按 `id`；其他板块的项被排除；空输入返回两个空数组。
- [ ] **Step 2: 运行确认失败**：`npx vitest run src/features/lane/items.test.ts`。
- [ ] **Step 3: 实现**。
- [ ] **Step 4: 运行确认通过**。
- [ ] **Step 5: 提交**：`git commit -am "feat: merge and group lane phases and milestones"`

---

### Task 6: 撤销重做快捷键拆出

**Files:**
- Create: `src/features/editor/useUndoKeys.ts`
- Modify: `src/features/timeline/useTimelineKeys.ts`
- Test: `src/features/editor/useUndoKeys.test.tsx`（新）；已有 `keys.test.tsx` 必须仍然通过

**Interfaces:**
- Produces:
  - `useUndoKeys(enabled?: boolean): void`（默认 `true`）：监听 `window` 的 `keydown`；`Ctrl/Cmd+Z` 撤销，`Ctrl/Cmd+Shift+Z` 和 `Ctrl/Cmd+Y` 重做；焦点在 `input`、`textarea`、`select` 或可编辑元素里时不响应；响应时 `preventDefault`。
  - `isTyping(target: EventTarget | null): boolean`：从 `useTimelineKeys.ts` 移到这里导出。
- `useTimelineKeys` 内部改为调用 `useUndoKeys(enabled)`，其余按键逻辑不变。

- [ ] **Step 1: 写失败的测试**：用一个只挂 `useUndoKeys` 的测试组件，改一次数据后按 `Ctrl+Z` 恢复、`Ctrl+Shift+Z` 重做、`Ctrl+Y` 重做；焦点在 `<textarea>` 里时不触发；`enabled=false` 时不触发；方向键、`Delete`、`T` 不被它处理。
- [ ] **Step 2: 运行确认失败**：`npx vitest run src/features/editor/useUndoKeys.test.tsx`。
- [ ] **Step 3: 实现并让 `useTimelineKeys` 复用**。
- [ ] **Step 4: 运行**：`npx vitest run src/features/editor src/features/timeline`，预期包括已有的 `keys.test.tsx` 全部通过。
- [ ] **Step 5: 提交**：`git commit -am "refactor: split undo shortcuts out of the timeline keys"`

---

### Task 7: 页面外壳（列表、标题、选中、空状态）

**Files:**
- Create: `src/features/lane/LanePage.tsx`、`LaneSidebar.tsx`、`LaneHeader.tsx`
- Modify: `src/app/App.tsx`（`route === 'modules'` 挂 `LanePage`）
- Modify: `src/features/editor/AddMenu.tsx`：导出 `addPhaseToLane(laneId: string): void` 和 `addMilestoneToLane(laneId: string): void`（把原来 `addPhase`、`addMilestone` 的主体搬进去，原函数改为取第一个板块后调用它们，行为不变）
- Test: `src/features/lane/LanePage.test.tsx`

**Interfaces:**
- Consumes: `resolveLaneId`、`laneHref`（Task 4）；`useUndoKeys`（Task 6）；`summarizeLane`（`features/home/summary`）；`LaneMenu`、`addLaneAndRename`、`EmptyState`、`useToday`、`useEditorStore`。
- Produces:
  - `LanePage({ param }: { param: string | null }): JSX.Element`：没有板块时返回 `<EmptyState />`；否则渲染 `LaneSidebar` 和所选板块的详情，并像 `Timeline` 那样在 `editing` 不为空时渲染 `PhaseEditor`/`MilestoneEditor`（`anchor={null}`）；调用 `useUndoKeys()`。详情区先放 `LaneHeader`，后面的任务往里加卡片，每个卡片用 `key={lane.id}`。
  - `LaneSidebar({ lanes, selectedId, today }): JSX.Element`：每行是指向 `laneHref(id)` 的 `<a>`，含色点、名称、当前阶段名或“暂无进行中阶段”；所选行 `aria-current="page"`；`ArrowUp/ArrowDown` 在行间移动焦点；底部“添加板块”按钮调用 `addLaneAndRename`，新板块建好后跳到它的网址。
  - `LaneHeader({ lane, summary, today })`：板块名（`font-serif`）、`LaneMenu`、摘要一行（当前阶段、进度、下一个节点、下一阶段，文字规则同主页板块概览卡）。

- [ ] **Step 1: 写失败的测试**：`param` 缺省时选中排在第一位的板块；`param` 指向第二个板块时详情显示它的名字，侧栏该行 `aria-current`；`param` 无效时回退到第一个且不报错；没有板块时显示“开始规划你的时间线”；点侧栏另一行后 `window.location.hash` 变为 `#/modules/<id>`；删除当前选中的板块（`LaneMenu` 的“删除板块”）后详情回到第一个板块；撤销后不报错；侧栏 `ArrowDown` 把焦点移到下一行；“添加板块”后新板块被选中；`Ctrl+Z` 能撤销在本页做的修改。
- [ ] **Step 2: 运行确认失败**：`npx vitest run src/features/lane/LanePage.test.tsx`。
- [ ] **Step 3: 实现**，视觉沿用全局页的画布和卡片规则。
- [ ] **Step 4: 运行**：`npm run typecheck && npx vitest run`，预期全部通过（含 `TopBar.test.tsx`、`editor.test.tsx`，确认 `AddMenu` 重构不改行为）。
- [ ] **Step 5: 提交**：`git commit -am "feat: lane page shell with sidebar and header"`

---

### Task 8: 备注

**Files:**
- Create: `src/features/lane/NoteCard.tsx`
- Modify: `src/features/lane/LanePage.tsx`（在 `LaneHeader` 之后放 `<NoteCard key={lane.id} lane={lane} />`）
- Test: `src/features/lane/NoteCard.test.tsx`

**Interfaces:**
- Consumes: `useStore().updateLane`、`NOTE_MAX`、`useDraft`（`features/editor/fields`）。
- Produces: `NoteCard({ lane }: { lane: Lane }): JSX.Element`：标题“备注”；多行文本框（`aria-label="板块备注"`），空时占位文字“写点什么：目标、注意事项……”；右下角显示 `已写字数 / 2000`；失焦时若内容变了且不超过 `NOTE_MAX` 就调用 `updateLane(lane.id, { note })`；超过时在文本框下显示“超出 N 字，缩短后才能保存”，失焦不保存，已输入内容保留。

- [ ] **Step 1: 写失败的测试**：输入后失焦，`store` 里 `note` 变了；内容没变时失焦不产生新的撤销步（`data` 引用不变）；失焦保存后 `undo` 恢复旧备注，文本框随之更新；输入 2001 字后失焦，`note` 不变、出现“超出 1 字”提示、文本框内容仍是已输入的；再删到 2000 字失焦则保存成功；字数计数正确。
- [ ] **Step 2: 运行确认失败**：`npx vitest run src/features/lane/NoteCard.test.tsx`。
- [ ] **Step 3: 实现**。
- [ ] **Step 4: 运行确认通过**。
- [ ] **Step 5: 提交**：`git commit -am "feat: lane note card"`

---

### Task 9: 资料链接

**Files:**
- Create: `src/features/lane/LinksCard.tsx`
- Modify: `src/features/lane/LanePage.tsx`（备注之后放 `<LinksCard key={lane.id} lane={lane} />`）
- Test: `src/features/lane/LinksCard.test.tsx`

**Interfaces:**
- Consumes: `addLink`、`updateLink`、`removeLink`（Task 3）、`normalizeLinkUrl`、`LINKS_MAX`、`NAME_MAX`、`showDeleteToast`（`features/editor/deleteToast`）。
- Produces: `LinksCard({ lane }: { lane: Lane }): JSX.Element`：
  - 列表行是一个 `<a href={url} target="_blank" rel="noopener noreferrer">`，显示标题，右侧小字显示 `new URL(url).hostname`；行尾“修改”“删除”按钮（`aria-label` 带标题）。
  - “添加链接”展开表单（标题、网址两个输入框，“保存”“取消”）；修改就地展开同一个表单并带入当前值；回车提交，`Esc` 取消。
  - 提交时：标题去空白为空则提示“请填写标题”；网址 `normalizeLinkUrl` 为 `null` 则提示“请输入以 http 或 https 开头的网址”；都不保存。
  - 删除调用 `removeLink` 后 `showDeleteToast(title)`。
  - 没有链接时显示“还没有资料链接”；已有 50 条时隐藏“添加链接”并显示“最多 50 条”。

- [ ] **Step 1: 写失败的测试**：添加 `'example.com/a'` 后列表出现该标题，`href` 为 `'https://example.com/a'`，且 `target="_blank"`、`rel` 含 `noopener` 和 `noreferrer`；输入 `'javascript:alert(1)'` 提交出现提示、数据不变；标题为空出现提示；修改标题和网址后保存生效，`Esc` 取消不改；删除后列表少一条、出现“已删除”提示条、点“撤销”恢复；超过 40 字的标题输入框 `maxLength` 为 40；50 条时没有“添加链接”；空状态文字；切换板块（`key` 变化）后表单状态不残留。
- [ ] **Step 2: 运行确认失败**：`npx vitest run src/features/lane/LinksCard.test.tsx`。
- [ ] **Step 3: 实现**。
- [ ] **Step 4: 运行确认通过**。
- [ ] **Step 5: 提交**：`git commit -am "feat: lane resource links card"`

---

### Task 10: 阶段与节点列表

**Files:**
- Create: `src/features/lane/ItemsCard.tsx`
- Modify: `src/features/lane/LanePage.tsx`（链接之后放 `<ItemsCard key={lane.id} lane={lane} today={today} />`）
- Test: `src/features/lane/ItemsCard.test.tsx`

**Interfaces:**
- Consumes: `buildLaneItems`、`PHASE_STATUS_TEXT`（Task 5）；`addPhaseToLane`、`addMilestoneToLane`（Task 7）；`openEditor`、`useEditorStore`；`useStore`（`select`、`selection`）；`formatRange`、`formatDay`、`countdownText`（`features/timeline/format`）。
- Produces: `ItemsCard({ lane, today }: { lane: Lane; today: number }): JSX.Element`：
  - 顶部“添加阶段”“添加节点”按钮，分别调用 `addPhaseToLane(lane.id)`、`addMilestoneToLane(lane.id)`。
  - `current` 组的每一行是一个 `<button>`：类型图标、名称、日期（阶段用 `formatRange(start, end)`，节点用 `formatDay`）、状态标签（阶段用 `PHASE_STATUS_TEXT`，节点用 `countdownText`）；点击时 `select` 并 `openEditor(kind, id)`。
  - `ended` 组默认折叠成一个 `aria-expanded` 的按钮“已结束 N 项”，点击展开；当 `selection` 或 `editing` 指向某个已结束项时自动展开。
  - 没有任何阶段和节点时显示空状态“这个板块还没有阶段和节点”；`ended` 为空时不显示折叠按钮。

- [ ] **Step 1: 写失败的测试**：混排顺序和状态文字；已结束项默认不在文档里，点“已结束 N 项”后出现；选中一个已结束项（`store.select`）时自动展开；对已结束项 `openEditor` 后行仍然可见；点一行打开对应编辑面板，面板里改名后列表和 `store` 同步；“添加阶段”和“添加节点”新建的项属于当前板块（不是第一个板块）且立刻打开编辑面板；空状态；节点的倒计时文字。
- [ ] **Step 2: 运行确认失败**：`npx vitest run src/features/lane/ItemsCard.test.tsx`。
- [ ] **Step 3: 实现**。
- [ ] **Step 4: 运行确认通过**。
- [ ] **Step 5: 提交**：`git commit -am "feat: lane phases and milestones list"`

---

### Task 11: 主页入口、文档、整体验收

**Files:**
- Modify: `src/features/home/LaneOverview.tsx`（卡片外层改成 `<a href={laneHref(lane.id)}>`，保留 `data-testid`、`data-lane-color`，加焦点样式和悬停阴影加深）
- Modify: `src/features/home/Home.test.tsx`、`CHANGELOG.md`、`README.md`、`docs/superpowers/specs/2026-11-11-lane-detail-design.md`（状态改为“已实施”）、`docs/superpowers/specs/2026-11-10-personal-os-v1-design.md`（第 12 节第 1 项标注已做）
- Test: `src/features/home/Home.test.tsx`

**Interfaces:**
- Consumes: `laneHref`（Task 4）。

- [ ] **Step 1: 写失败的测试**：主页每张板块概览卡是链接，`href` 等于 `laneHref(id)`；点击后进入 `#/modules/<id>` 且详情显示该板块名；已有主页测试仍通过（`Home.test.tsx` 里“卡片暂时不能点击”的描述若存在需同步）。
- [ ] **Step 2: 运行确认失败**：`npx vitest run src/features/home`。
- [ ] **Step 3: 实现卡片链接**；更新 `CHANGELOG.md`“未发布”（新增：板块页、资料链接、备注；变更：数据版本升到 2，旧数据和备份自动升级）、`README.md`（功能列表加板块页，把“日历、板块、今日三个视图还没做”改为“日历、今日两个视图还没做”，目录说明加 `lane/`）、两份设计文档的状态。
- [ ] **Step 4: 全量检查**：`npm run lint && npm run typecheck && npm test && npm run build && npm run check:size`，预期全部通过，脚本体积不超过 200 KB。
- [ ] **Step 5: 在浏览器里走一遍 spec 第 8 节验收清单**（`npm run dev`，内置浏览器打开）：逐条完成；另外检查：用旧数据（先在浏览器里存一份版本 1 的 JSON，再刷新）能升级且 `personal-os:data:backup-v1` 存在；链接在新标签页打开；窗口宽 1024 像素时布局不破；系统开启“减少动态效果”时没有多余动画。发现问题就回到对应任务修复并补测试。
- [ ] **Step 6: 提交**：`git add -A && git commit -m "feat: link overview cards to the lane page and update docs"`

---

## Self-Review（已执行）

- **Spec 覆盖**：第 2 节数据 → Task 1、2、3；第 3 节路由 → Task 4、7、11；第 4.1 侧栏 → Task 7；4.2 标题区 → Task 7，备注 → Task 8，链接 → Task 9，阶段与节点 → Task 5、10；4.3 键盘 → Task 6、7；第 5 节代码结构 → 文件结构一节；第 6 节出错处理 → Review Focus 对应的测试分布在 Task 2、3、7、8、9、10；第 7、8 节 → 各任务测试和 Task 11 验收。无遗漏。
- **类型一致**：`Link`、`LINKS_MAX`、`normalizeLinkUrl`、`isHttpUrl`、`resolveLaneId`、`laneHref`、`buildLaneItems`、`LaneItem`、`PhaseStatus`、`useUndoKeys`、`addPhaseToLane`、`addMilestoneToLane` 在定义任务和使用任务里名称和签名一致。
- **与 spec 的一处偏差**：spec 2.4 写“`updateLane` 补丁扩展到 `name | color | note`”，本计划进一步规定非法值（超长备注）由 store 拒绝，因为不拒绝会导致存下的数据下次读取校验失败；这是对 spec 出错处理一节意图的落实，不是新增功能。
