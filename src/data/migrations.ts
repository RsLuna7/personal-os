export class NewerVersionError extends Error {
  constructor(found: number, supported: number) {
    super(`数据版本 ${found} 比应用支持的版本 ${supported} 新`)
    this.name = 'NewerVersionError'
  }
}

/** 把第 n 版数据升级为第 n+1 版。 */
export type Migration = (old: unknown) => unknown

/** 第一版没有历史版本。以后每升一版在这里登记：`{ 1: v1ToV2, 2: v2ToV3 }`。 */
export const migrations: Record<number, Migration> = {}

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
