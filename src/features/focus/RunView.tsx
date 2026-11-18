import { useEffect, useState } from 'react'
import { CheckIcon, PauseIcon, PlayIcon, SkipForwardIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useFocusStore } from './focusStore'
import { tagColor } from './stats'
import { elapsedMs, runClock, targetMs, type Phase, type RunState } from './timer'
import { useNow } from './useNow'

const PHASE_LABEL: Record<Phase, string> = { focus: '专注', break: '休息', ready: '休息结束' }
const CONFIRM_MS = 3000

function modeText(run: RunState): string {
  return run.mode === 'stopwatch'
    ? '正计时'
    : `番茄钟 ${Math.round(run.focusMs / 60_000)}/${Math.round(run.breakMs / 60_000)}`
}

interface RunViewProps {
  run: RunState
  /** 首页角落的小卡片 */
  compact?: boolean
}

/** 正在计时：时间、标签、进度，和暂停、完成、放弃等按钮。 */
export function RunView({ run, compact = false }: RunViewProps) {
  const store = useFocusStore.getState
  const now = useNow(run.phase !== 'ready')
  const [confirming, setConfirming] = useState(false)

  // “确认放弃”只等几秒，不点就退回去
  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS)
    return () => clearTimeout(timer)
  }, [confirming])

  const paused = run.pausedAt !== null
  const target = targetMs(run)
  const progress = target ? Math.min(1, elapsedMs(run, now) / target) : null
  const buttonSize = compact ? 'sm' : 'default'

  const finish = () => {
    if (store().finish() === 'short') toast('不足 1 分钟，没有保存')
  }

  return (
    <div
      data-testid="run-view"
      data-phase={run.phase}
      data-lane-color={tagColor(run.tag)}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-2 text-[13px] text-(--text-muted)">
        <span aria-hidden className="lane-chip-dot" />
        <span className="min-w-0 truncate font-medium text-(--text)" title={run.note || run.tag}>
          {run.tag}
        </span>
        <span className="shrink-0">
          · {PHASE_LABEL[run.phase]}
          {run.phase === 'focus' && ` · ${modeText(run)}`}
          {paused && ' · 已暂停'}
        </span>
      </div>

      {run.phase !== 'ready' && (
        <>
          <p
            role="timer"
            aria-label={`${PHASE_LABEL[run.phase]}时间`}
            className={`font-serif font-bold tabular-nums ${compact ? 'text-[32px]' : 'text-[56px]'} leading-none text-(--text)`}
          >
            {runClock(run, now)}
          </p>
          {progress !== null && (
            <div aria-hidden className="h-1 overflow-hidden rounded-full bg-(--sand-4)">
              <div
                className="h-full rounded-full bg-(--lane-dot) transition-[width] duration-(--dur-slow) ease-(--ease-out)"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {run.phase === 'ready' ? (
          <>
            <Button size={buttonSize} onClick={() => store().next()}>
              <PlayIcon aria-hidden />
              开始下一轮
            </Button>
            <Button size={buttonSize} variant="outline" onClick={() => store().endCycle()}>
              结束
            </Button>
          </>
        ) : (
          <>
            <Button
              size={buttonSize}
              variant="outline"
              onClick={() => (paused ? store().resume() : store().pause())}
            >
              {paused ? <PlayIcon aria-hidden /> : <PauseIcon aria-hidden />}
              {paused ? '继续' : '暂停'}
            </Button>
            {run.phase === 'focus' ? (
              <>
                <Button size={buttonSize} onClick={finish}>
                  <CheckIcon aria-hidden />
                  {run.mode === 'stopwatch' ? '完成' : '提前完成'}
                </Button>
                <Button
                  size={buttonSize}
                  variant={confirming ? 'destructive' : 'ghost'}
                  onClick={() => {
                    if (confirming) store().abandon()
                    else setConfirming(true)
                  }}
                >
                  <XIcon aria-hidden />
                  {confirming ? '确认放弃' : '放弃'}
                </Button>
              </>
            ) : (
              <Button size={buttonSize} variant="ghost" onClick={() => store().endCycle()}>
                <SkipForwardIcon aria-hidden />
                跳过休息
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
