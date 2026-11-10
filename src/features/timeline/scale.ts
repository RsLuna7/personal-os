export interface Scale {
  /** 画布 x = 0 处对应的整日数（可为小数） */
  originDay: number
  pxPerDay: number
}

export const MIN_PX_PER_DAY = 0.5
export const MAX_PX_PER_DAY = 24
export const MONTH_TICK_MIN_PX_PER_DAY = 1.5

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
const QUARTER_LEAD_DAYS = 14
const YEAR_DAYS = 365
const YEAR_LEAD_DAYS = 30
const ALL_PADDING = 0.05

export function presetScale(
  preset: ZoomPreset,
  viewportWidth: number,
  todayDay: number,
  range: { min: number; max: number } | null,
): Scale {
  if (preset === 'quarter') {
    return {
      originDay: todayDay - QUARTER_LEAD_DAYS,
      pxPerDay: clampPx(viewportWidth / QUARTER_DAYS),
    }
  }
  if (preset === 'all' && range && range.max > range.min) {
    const span = range.max - range.min
    const padding = span * ALL_PADDING
    return {
      originDay: range.min - padding,
      pxPerDay: clampPx(viewportWidth / (span + padding * 2)),
    }
  }
  return { originDay: todayDay - YEAR_LEAD_DAYS, pxPerDay: clampPx(viewportWidth / YEAR_DAYS) }
}
