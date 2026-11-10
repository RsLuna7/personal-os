import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const LIMIT = 200 * 1024
const dir = join('dist', 'assets')

let files
try {
  files = readdirSync(dir).filter((f) => f.endsWith('.js'))
} catch {
  console.error(`找不到 ${dir}，请先运行 npm run build`)
  process.exit(1)
}

let total = 0
for (const file of files) {
  const size = gzipSync(readFileSync(join(dir, file))).length
  total += size
  console.log(`${file}: ${(size / 1024).toFixed(1)} KB (gzip)`)
}

const kb = (total / 1024).toFixed(1)
if (total > LIMIT) {
  console.error(`脚本总量 ${kb} KB (gzip)，超过上限 ${LIMIT / 1024} KB`)
  process.exit(1)
}
console.log(`脚本总量 ${kb} KB (gzip)，上限 ${LIMIT / 1024} KB`)
