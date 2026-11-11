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

/** 以后每升一版在这里登记：`{ 1: v1ToV2, 2: v2ToV3 }`。 */
export const migrations: Record<number, Migration> = { 1: v1ToV2 }

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
