import { create } from 'zustand'
import {
  appDataSchema,
  createEmptyData,
  LANE_COLORS,
  LINKS_MAX,
  NAME_MAX,
  NOTE_MAX,
  URL_MAX,
  type AppData,
  type ISODate,
  type Lane,
  type LaneColor,
  type Link,
  type Milestone,
  type Phase,
  type Term,
} from './schema'
import { normalizeLinkUrl } from './links'

export const HISTORY_LIMIT = 100

export type Selection = { kind: 'phase' | 'milestone'; id: string }

interface StoreState {
  data: AppData
  past: AppData[]
  future: AppData[]
  selection: Selection | null

  addLane(name?: string): string
  /** 备注超过 2000 字时整个调用不生效。 */
  updateLane(id: string, patch: Partial<Pick<Lane, 'name' | 'color' | 'note'>>): void
  moveLane(id: string, direction: -1 | 1): void
  removeLane(id: string): void
  /** 返回新链接的 id；标题、网址不合法、板块不存在或已满 50 条时返回 ''，数据不变。 */
  addLink(laneId: string, input: { title: string; url: string }): string
  /** 修改后不合法就不生效。 */
  updateLink(laneId: string, linkId: string, patch: Partial<Pick<Link, 'title' | 'url'>>): void
  removeLink(laneId: string, linkId: string): void
  addPhase(input: { laneId: string; start: ISODate; end: ISODate; name?: string }): string
  updatePhase(id: string, patch: Partial<Omit<Phase, 'id'>>): void
  removePhase(id: string): void
  addMilestone(input: { laneId: string; date: ISODate; name?: string }): string
  updateMilestone(id: string, patch: Partial<Omit<Milestone, 'id'>>): void
  removeMilestone(id: string): void
  setTerms(terms: Term[]): void
  /** 整体替换数据，可撤销（导入、载入示例、清空）。 */
  replaceData(data: AppData): void
  /** 整体替换数据，不可撤销并清空历史（启动、跨标签页同步）。 */
  hydrate(data: AppData): void
  /** 记录导出时间，不进入历史。 */
  markExported(at: string): void
  undo(): void
  redo(): void
  select(selection: Selection | null): void
}

function newId(): string {
  return crypto.randomUUID()
}

/** 整理标题和网址；任何一项不合法返回 null。写进数据前必须过这一关，否则存下的数据下次读不出来。 */
function cleanLink(title: string, url: string): Pick<Link, 'title' | 'url'> | null {
  const cleanTitle = title.trim()
  if (cleanTitle === '' || cleanTitle.length > NAME_MAX) return null
  const cleanUrl = normalizeLinkUrl(url)
  if (cleanUrl === null || cleanUrl.length > URL_MAX) return null
  return { title: cleanTitle, url: cleanUrl }
}

function sortedLanes(lanes: Lane[]): Lane[] {
  return [...lanes].sort((a, b) => a.order - b.order)
}

function nextLaneColor(lanes: Lane[]): LaneColor {
  const used = new Set(lanes.map((lane) => lane.color))
  return (
    LANE_COLORS.find((color) => !used.has(color)) ?? LANE_COLORS[lanes.length % LANE_COLORS.length]
  )
}

function keepSelection(selection: Selection | null, data: AppData): Selection | null {
  if (!selection) return null
  const list = selection.kind === 'phase' ? data.phases : data.milestones
  return list.some((item) => item.id === selection.id) ? selection : null
}

export const useStore = create<StoreState>()((set, get) => {
  /** 所有修改的唯一入口：校验、去重、记入历史。校验失败抛错且不改状态。 */
  function commit(next: AppData): void {
    const { data, past, selection } = get()
    const valid = appDataSchema.parse(next)
    if (JSON.stringify(valid) === JSON.stringify(data)) return
    set({
      data: valid,
      past: [...past, data].slice(-HISTORY_LIMIT),
      future: [],
      selection: keepSelection(selection, valid),
    })
  }

  return {
    data: createEmptyData(),
    past: [],
    future: [],
    selection: null,

    addLane(name = '新板块') {
      const { data } = get()
      const id = newId()
      const order = data.lanes.reduce((max, lane) => Math.max(max, lane.order + 1), 0)
      commit({
        ...data,
        lanes: [
          ...data.lanes,
          { id, name, color: nextLaneColor(data.lanes), order, note: '', links: [] },
        ],
      })
      return id
    },

    updateLane(id, patch) {
      if (patch.note !== undefined && patch.note.length > NOTE_MAX) return
      const { data } = get()
      commit({
        ...data,
        lanes: data.lanes.map((lane) => (lane.id === id ? { ...lane, ...patch } : lane)),
      })
    },

    addLink(laneId, input) {
      const { data } = get()
      const lane = data.lanes.find((item) => item.id === laneId)
      const cleaned = cleanLink(input.title, input.url)
      if (!lane || !cleaned || lane.links.length >= LINKS_MAX) return ''
      const id = newId()
      commit({
        ...data,
        lanes: data.lanes.map((item) =>
          item.id === laneId ? { ...item, links: [...item.links, { id, ...cleaned }] } : item,
        ),
      })
      return id
    },

    updateLink(laneId, linkId, patch) {
      const { data } = get()
      const link = data.lanes.find((item) => item.id === laneId)?.links.find((l) => l.id === linkId)
      if (!link) return
      const cleaned = cleanLink(patch.title ?? link.title, patch.url ?? link.url)
      if (!cleaned) return
      commit({
        ...data,
        lanes: data.lanes.map((item) =>
          item.id === laneId
            ? {
                ...item,
                links: item.links.map((l) => (l.id === linkId ? { ...l, ...cleaned } : l)),
              }
            : item,
        ),
      })
    },

    removeLink(laneId, linkId) {
      const { data } = get()
      commit({
        ...data,
        lanes: data.lanes.map((item) =>
          item.id === laneId ? { ...item, links: item.links.filter((l) => l.id !== linkId) } : item,
        ),
      })
    },

    moveLane(id, direction) {
      const { data } = get()
      const ordered = sortedLanes(data.lanes)
      const from = ordered.findIndex((lane) => lane.id === id)
      const to = from + direction
      if (from === -1 || to < 0 || to >= ordered.length) return
      ;[ordered[from], ordered[to]] = [ordered[to], ordered[from]]
      const orderById = new Map(ordered.map((lane, index) => [lane.id, index]))
      commit({
        ...data,
        lanes: data.lanes.map((lane) => ({ ...lane, order: orderById.get(lane.id)! })),
      })
    },

    removeLane(id) {
      const { data } = get()
      const remaining = sortedLanes(data.lanes.filter((lane) => lane.id !== id))
      const orderById = new Map(remaining.map((lane, index) => [lane.id, index]))
      commit({
        ...data,
        lanes: data.lanes
          .filter((lane) => lane.id !== id)
          .map((lane) => ({ ...lane, order: orderById.get(lane.id)! })),
        phases: data.phases.filter((phase) => phase.laneId !== id),
        milestones: data.milestones.filter((milestone) => milestone.laneId !== id),
      })
    },

    addPhase({ laneId, start, end, name = '新阶段' }) {
      const { data } = get()
      const id = newId()
      commit({
        ...data,
        phases: [...data.phases, { id, laneId, name, start, end, tentative: false, note: '' }],
      })
      return id
    },

    updatePhase(id, patch) {
      const { data } = get()
      commit({
        ...data,
        phases: data.phases.map((phase) => (phase.id === id ? { ...phase, ...patch } : phase)),
      })
    },

    removePhase(id) {
      const { data } = get()
      commit({ ...data, phases: data.phases.filter((phase) => phase.id !== id) })
    },

    addMilestone({ laneId, date, name = '新节点' }) {
      const { data } = get()
      const id = newId()
      commit({ ...data, milestones: [...data.milestones, { id, laneId, name, date, note: '' }] })
      return id
    },

    updateMilestone(id, patch) {
      const { data } = get()
      commit({
        ...data,
        milestones: data.milestones.map((milestone) =>
          milestone.id === id ? { ...milestone, ...patch } : milestone,
        ),
      })
    },

    removeMilestone(id) {
      const { data } = get()
      commit({ ...data, milestones: data.milestones.filter((milestone) => milestone.id !== id) })
    },

    setTerms(terms) {
      commit({ ...get().data, terms })
    },

    replaceData(data) {
      commit({ ...data, lastExportAt: get().data.lastExportAt })
    },

    hydrate(data) {
      set({ data: appDataSchema.parse(data), past: [], future: [], selection: null })
    },

    markExported(at) {
      set({ data: { ...get().data, lastExportAt: at } })
    },

    undo() {
      const { data, past, future, selection } = get()
      const previous = past.at(-1)
      if (!previous) return
      const restored = { ...previous, lastExportAt: data.lastExportAt }
      set({
        data: restored,
        past: past.slice(0, -1),
        future: [data, ...future],
        selection: keepSelection(selection, restored),
      })
    },

    redo() {
      const { data, past, future, selection } = get()
      const next = future[0]
      if (!next) return
      const restored = { ...next, lastExportAt: data.lastExportAt }
      set({
        data: restored,
        past: [...past, data].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        selection: keepSelection(selection, restored),
      })
    },

    select(selection) {
      set({ selection })
    },
  }
})
