const HAS_SCHEME = /:\/\//
/** 没有 `://` 但明显是别的协议的写法，不能当成域名补上 https:// */
const OTHER_SCHEME = /^(javascript|data|file|vbscript|mailto|tel|blob|about):/i

function isHttpProtocol(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:'
}

/** 已存的网址是否合法：能解析，且协议是 http 或 https。不补全。 */
export function isHttpUrl(text: string): boolean {
  try {
    return isHttpProtocol(new URL(text))
  } catch {
    return false
  }
}

/**
 * 把用户输入的网址整理成可以保存的形式。没写协议时补 https://；
 * 协议不是 http 或 https、或解析不了时返回 null。
 */
export function normalizeLinkUrl(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  if (!HAS_SCHEME.test(trimmed) && OTHER_SCHEME.test(trimmed)) return null

  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    return isHttpProtocol(url) ? url.href : null
  } catch {
    return null
  }
}
