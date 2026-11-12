export interface Scale {
  /** 画布 x = 0 处对应的整日数（可为小数） */
  originDay: number
  pxPerDay: number
}

export const MIN_PX_PER_DAY = 0.5
export const MAX_PX_PER_DAY = 24
export const MONTH_TICK_MIN_PX_PER_DAY = 1.5
/** 一周至少约 17 像素时画周线，再密就只剩一片灰 */
export const WEEK_LINE_MIN_PX_PER_DAY = 2.5
/** 一周至少 56 像素时在标尺上标出每一周，放得下“第10周” */
export const WEEK_LABEL_MIN_PX_PER_DAY = 8

export type ZoomPreset = 'quarter' | 'year' | 'all'

const clampPx = (px: number) => Math.min(MAX_PX_PER_DAY, Math.max(MIN_PX_PER_DAY, px))

export function dayToX(s: Scale, day: number): number {
  return (day - s.originDay) * s.pxPerDay
}

export function xToDay(s: Scale, x: number): number {
  return Math.floor(s.originDay + x / s.pxPerDay)
}

/** 缩放并保持 anchorX 处的日期不动。 */
export function zoomAt(s: Scale, factor: number, anchorX: number): Scale {
  const pxPerDay = clampPx(s.pxPerDay * factor)
  const anchorDay = s.originDay + anchorX / s.pxPerDay
  return { originDay: anchorDay - anchorX / pxPerDay, pxPerDay }
}

/** 内容向右移动 dx 像素（dx 为负则向左）。 */
export function panBy(s: Scale, dx: number): Scale {
  return { originDay: s.originDay - dx / s.pxPerDay, pxPerDay: s.pxPerDay }
}

const QUARTER_DAYS = 92
const YEAR_DAYS = 365
const ALL_PADDING = 0.05
/** “全部”至少显示这么多天；数据只有几周时不会放大到比“近三个月”还近 */
const ALL_MIN_DAYS = YEAR_DAYS
/** 今天在画布上的位置：左起四分之一。档位按钮、回到今天、打开页面都用这一个位置 */
export const TODAY_POSITION = 0.25

/** 每一档要显示多少天；“全部”取决于数据，返回 null */
export function presetDays(preset: ZoomPreset): number | null {
  if (preset === 'quarter') return QUARTER_DAYS
  if (preset === 'year') return YEAR_DAYS
  return null
}

export function presetScale(
  preset: ZoomPreset,
  viewportWidth: number,
  todayDay: number,
  range: { min: number; max: number } | null,
): Scale {
  if (preset === 'all' && range && range.max > range.min) {
    const span = range.max - range.min
    const padding = span * ALL_PADDING
    const shown = Math.max(span + padding * 2, ALL_MIN_DAYS)
    // 数据跨度不到一年时，让数据居中
    const middle = (range.min + range.max) / 2
    return {
      originDay: middle - shown / 2,
      pxPerDay: clampPx(viewportWidth / shown),
    }
  }
  const days = preset === 'quarter' ? QUARTER_DAYS : YEAR_DAYS
  const pxPerDay = clampPx(viewportWidth / days)
  return { originDay: todayDay - (viewportWidth * TODAY_POSITION) / pxPerDay, pxPerDay }
}
