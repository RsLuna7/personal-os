import { Button } from '@/components/ui/button'
import type { ZoomPreset } from './scale'
import { useViewport } from './useViewport'

const ZOOM: { preset: ZoomPreset; label: string }[] = [
  { preset: 'quarter', label: '近三个月' },
  { preset: 'year', label: '一年' },
  { preset: 'all', label: '全部' },
]

/** 缩放三档和“回到今天”，顶栏和主页的时间线卡片共用。 */
export function ZoomControls() {
  const { preset, setPreset, goToToday } = useViewport()

  return (
    <>
      <div
        role="group"
        aria-label="缩放"
        className="flex items-center rounded-[6px] border border-(--border) p-0.5"
      >
        {ZOOM.map((item) => {
          const active = item.preset === preset
          return (
            <button
              key={item.preset}
              type="button"
              aria-pressed={active}
              onClick={() => setPreset(item.preset)}
              className={
                'rounded-[4px] px-2 py-0.5 text-[14px] transition-colors duration-(--dur-fast) ease-(--ease-out) ' +
                (active
                  ? 'bg-(--bg-panel) font-medium text-(--text)'
                  : 'text-(--text-muted) hover:text-(--text)')
              }
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <Button variant="outline" size="sm" onClick={goToToday}>
        回到今天
      </Button>
    </>
  )
}
