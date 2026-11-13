export class NewerVersionError extends Error {
  constructor(found: number, supported: number) {
    super(`数据版本 ${found} 比应用支持的版本 ${supported} 新`)
    this.name = 'NewerVersionError'
  }
}

/** 把第 n 版数据升级为第 n+1 版。 */
export type Migration = (old: unknown) => unknown

/**
 * 版本 1 → 2：每个板块新增备注和资料链接。
 * lanes 不是数组时原样放过，交给校验去拒绝。
 */
function v1ToV2(old: unknown): unknown {
  const data = old as { lanes?: unknown }
  return {
    ...data,
    schemaVersion: 2,
    lanes: Array.isArray(data.lanes)
      ? data.lanes.map((lane: object) => ({ note: '', links: [], ...lane }))
      : data.lanes,
  }
}

/** 版本 2 → 3：新增待办，旧数据没有待办。 */
function v2ToV3(old: unknown): unknown {
  return { todos: [], ...(old as object), schemaVersion: 3 }
}

/** 版本 3 → 4：阶段和节点新增“已完成”，旧数据一律是未完成。 */
function v3ToV4(old: unknown): unknown {
  const data = old as { phases?: unknown; milestones?: unknown }
  const addDone = (items: unknown) =>
    Array.isArray(items) ? items.map((item: object) => ({ done: false, ...item })) : items
  return {
    ...data,
    schemaVersion: 4,
    phases: addDone(data.phases),
    milestones: addDone(data.milestones),
  }
}

/** 版本 4 → 5：新增习惯（每日打卡），旧数据没有习惯。 */
function v4ToV5(old: unknown): unknown {
  const data = old as { habits?: unknown }
  return { ...data, schemaVersion: 5, habits: Array.isArray(data.habits) ? data.habits : [] }
}

/** 以后每升一版在这里登记：`{ …, 4: v4ToV5, 5: v5ToV6 }`。 */
export const migrations: Record<number, Migration> = {
  1: v1ToV2,
  2: v2ToV3,
  3: v3ToV4,
  4: v4ToV5,
}

export function runMigrations(
  raw: unknown,
  registry: Record<number, Migration>,
  target: number,
): { data: unknown; from: number } {
  const from =
    typeof raw === 'object' && raw !== null
      ? (raw as { schemaVersion?: unknown }).schemaVersion
      : undefined
  if (typeof from !== 'number' || !Number.isInteger(from) || from < 0) {
    throw new Error('数据缺少可用的版本号')
  }
  if (from > target) throw new NewerVersionError(from, target)

  let data = raw
  for (let version = from; version < target; version++) {
    const migrate = registry[version]
    if (!migrate) throw new Error(`缺少从第 ${version} 版升级的步骤`)
    data = migrate(data)
  }
  return { data, from }
}
