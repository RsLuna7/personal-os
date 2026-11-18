import { useMemo } from 'react'
import { useStore } from '@/data/store'
import { useUndoKeys } from '@/features/editor/useUndoKeys'
import { useToday } from '@/features/timeline/useToday'
import { TodaySection } from '@/features/today/TodaySection'
import { useFocusStore } from './focusStore'
import { FocusSettings } from './FocusSettings'
import { HeatmapGrid } from './HeatmapGrid'
import { RunView } from './RunView'
import { StartForm } from './StartForm'
import { formatDuration, heatmap, sessionsOn, totalMs, weekByTag } from './stats'
import { TodayRecords } from './TodayRecords'
import { WeekTags } from './WeekTags'

/**
 * 专注页：计时、今天的记录、本周按标签、最近 26 周的热力图。
 * 宽屏两列，窄一些上下排。
 */
export function FocusPage() {
  const sessions = useStore((state) => state.data.focusSessions)
  const run = useFocusStore((state) => state.run)
  const today = useToday()
  useUndoKeys()

  const records = useMemo(() => sessionsOn(sessions, today), [sessions, today])
  const week = useMemo(() => weekByTag(sessions, today), [sessions, today])
  const map = useMemo(() => heatmap(sessions, today), [sessions, today])

  return (
    <div data-testid="focus-page" className="min-h-0 flex-1 overflow-y-auto bg-(--bg-canvas)">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-serif text-[24px] font-bold text-(--text)">专注</h1>
          {records.length > 0 && (
            <span
              data-testid="focus-summary"
              className="text-[14px] text-(--text-muted) tabular-nums"
            >
              今天 {formatDuration(totalMs(records))} · {records.length} 次
            </span>
          )}
          <span className="ml-auto">
            <FocusSettings />
          </span>
        </header>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <TodaySection id="focus-timer-title" title="计时" testId="focus-timer">
            {run ? <RunView run={run} /> : <StartForm />}
          </TodaySection>
          <TodaySection id="focus-today-title" title="今日记录" testId="focus-today">
            <TodayRecords records={records} all={sessions} />
          </TodaySection>
          <TodaySection id="focus-week-title" title="本周按标签" testId="focus-week">
            <WeekTags rows={week} />
          </TodaySection>
          <TodaySection id="focus-heatmap-title" title="最近 26 周" testId="focus-heatmap">
            <HeatmapGrid map={map} />
          </TodaySection>
        </div>
      </div>
    </div>
  )
}
