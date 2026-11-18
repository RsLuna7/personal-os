import { useId, useState } from 'react'
import { PlayIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FOCUS_NOTE_MAX } from '@/data/schema'
import { useStore } from '@/data/store'
import { prepareAlerts } from './alerts'
import { useFocusStore } from './focusStore'
import { recentTags } from './stats'
import { TagInput } from './TagInput'
import { BREAK_MINUTES, FOCUS_MINUTES, PRESETS, type FocusMode } from './timer'

interface StartFormProps {
  /** 点了“开始”之后 */
  onStarted?: () => void
}

const MODES: { mode: FocusMode; label: string }[] = [
  { mode: 'pomodoro', label: '番茄钟' },
  { mode: 'stopwatch', label: '正计时' },
]

/** 开始一轮专注：模式、时长、标签、备注。首页组件和专注页共用。 */
export function StartForm({ onStarted }: StartFormProps) {
  const last = useFocusStore((state) => state.prefs.last)
  const sessions = useStore((state) => state.data.focusSessions)
  const [mode, setMode] = useState<FocusMode>(last.mode)
  const [focusText, setFocusText] = useState(String(last.focusMin))
  const [breakText, setBreakText] = useState(String(last.breakMin))
  const [custom, setCustom] = useState(
    () => !PRESETS.some((p) => p.focusMin === last.focusMin && p.breakMin === last.breakMin),
  )
  const [tag, setTag] = useState(last.tag)
  const [note, setNote] = useState('')
  const noteId = useId()
  const focusId = useId()
  const breakId = useId()

  const canStart = tag.trim() !== ''

  const start = () => {
    if (!canStart) return
    const store = useFocusStore.getState()
    prepareAlerts(store.prefs)
    store.start({
      mode,
      tag,
      note,
      focusMin: Number(focusText),
      breakMin: Number(breakText),
    })
    onStarted?.()
  }

  const pickPreset = (focusMin: number, breakMin: number) => {
    setFocusText(String(focusMin))
    setBreakText(String(breakMin))
    setCustom(false)
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        start()
      }}
    >
      <div role="group" aria-label="计时方式" className="flex gap-1">
        {MODES.map((item) => (
          <button
            key={item.mode}
            type="button"
            aria-pressed={mode === item.mode}
            onClick={() => setMode(item.mode)}
            className="lane-chip border border-(--border)"
          >
            {item.label}
          </button>
        ))}
      </div>

      {mode === 'pomodoro' && (
        <div className="flex flex-col gap-2">
          <div role="group" aria-label="时长" className="flex flex-wrap gap-1">
            {PRESETS.map((preset) => (
              <button
                key={preset.focusMin}
                type="button"
                aria-pressed={
                  !custom &&
                  Number(focusText) === preset.focusMin &&
                  Number(breakText) === preset.breakMin
                }
                onClick={() => pickPreset(preset.focusMin, preset.breakMin)}
                className="lane-chip border border-(--border) tabular-nums"
              >
                {preset.focusMin}/{preset.breakMin}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={custom}
              onClick={() => setCustom(true)}
              className="lane-chip border border-(--border)"
            >
              自定义
            </button>
          </div>
          {custom && (
            <div className="flex items-center gap-2 text-[13px] text-(--text-muted)">
              <label htmlFor={focusId}>专注</label>
              <Input
                id={focusId}
                type="number"
                inputMode="numeric"
                min={FOCUS_MINUTES.min}
                max={FOCUS_MINUTES.max}
                value={focusText}
                onChange={(event) => setFocusText(event.target.value)}
                className="w-16 tabular-nums"
              />
              <label htmlFor={breakId}>休息</label>
              <Input
                id={breakId}
                type="number"
                inputMode="numeric"
                min={BREAK_MINUTES.min}
                max={BREAK_MINUTES.max}
                value={breakText}
                onChange={(event) => setBreakText(event.target.value)}
                className="w-16 tabular-nums"
              />
              <span>分钟</span>
            </div>
          )}
        </div>
      )}

      <TagInput value={tag} onChange={setTag} history={recentTags(sessions)} />

      <div className="flex flex-col gap-1">
        <label htmlFor={noteId} className="sr-only">
          备注
        </label>
        <Input
          id={noteId}
          value={note}
          maxLength={FOCUS_NOTE_MAX}
          placeholder="这次做什么（选填）"
          autoComplete="off"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <Button type="submit" size="lg" disabled={!canStart}>
        <PlayIcon aria-hidden />
        开始
      </Button>
    </form>
  )
}
