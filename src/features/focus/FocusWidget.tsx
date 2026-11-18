import { useState } from 'react'
import { ChevronUpIcon, PlayIcon, TimerIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { routeHref } from '@/app/useHashRoute'
import { prepareAlerts } from './alerts'
import { useFocusStore } from './focusStore'
import { RunView } from './RunView'
import { StartForm } from './StartForm'
import { tagColor } from './stats'

/** 首页右下角常驻的小计时：空闲时一键照上次的设置开始，计时中显示时间和控制按钮。 */
export function FocusWidget() {
  const run = useFocusStore((state) => state.run)
  const last = useFocusStore((state) => state.prefs.last)
  const [open, setOpen] = useState(false)

  if (run) {
    return (
      <aside
        aria-label="专注计时"
        data-testid="focus-widget"
        className="fixed right-6 bottom-6 z-30 w-[248px] rounded-[16px] bg-(--bg-card) p-4 shadow-(--shadow-card-hover)"
      >
        <RunView run={run} compact />
        <a
          href={routeHref('focus')}
          className="mt-3 block text-[12px] text-(--text-muted) underline-offset-2 hover:text-(--text) hover:underline focus-visible:outline-2 focus-visible:outline-(--text)"
        >
          去专注页
        </a>
      </aside>
    )
  }

  const quickStart = () => {
    if (last.tag === '') {
      setOpen(true)
      return
    }
    const store = useFocusStore.getState()
    prepareAlerts(store.prefs)
    store.start({ ...last, note: '' })
  }

  const summary =
    last.tag === ''
      ? '专注'
      : `${last.mode === 'pomodoro' ? `${last.focusMin}/${last.breakMin}` : '正计时'} · ${last.tag}`

  return (
    <aside
      aria-label="专注计时"
      data-testid="focus-widget"
      className="fixed right-6 bottom-6 z-30 flex items-stretch rounded-full bg-(--bg-card) shadow-(--shadow-card-hover)"
    >
      <button
        type="button"
        data-lane-color={last.tag ? tagColor(last.tag) : undefined}
        onClick={quickStart}
        className="flex h-10 max-w-[220px] items-center gap-2 rounded-l-full pr-2 pl-4 text-[14px] text-(--text) transition-colors duration-(--dur-fast) hover:bg-(--bg-subtle) focus-visible:outline-2 focus-visible:outline-(--text)"
      >
        {last.tag === '' ? (
          <TimerIcon aria-hidden className="size-4 shrink-0" />
        ) : (
          <PlayIcon aria-hidden className="size-4 shrink-0 text-(--lane-dot)" />
        )}
        <span className="truncate">{last.tag === '' ? '专注' : `开始 ${summary}`}</span>
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="专注设置"
            className="flex h-10 w-9 items-center justify-center rounded-r-full text-(--text-muted) transition-colors duration-(--dur-fast) hover:bg-(--bg-subtle) hover:text-(--text) focus-visible:outline-2 focus-visible:outline-(--text)"
          >
            <ChevronUpIcon aria-hidden className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-[280px] gap-3 p-4">
          <StartForm onStarted={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
    </aside>
  )
}
