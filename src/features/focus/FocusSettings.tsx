import { useId } from 'react'
import { SettingsIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { prepareAlerts } from './alerts'
import { useFocusStore } from './focusStore'

/** 「专注」页标题右侧的齿轮：系统通知、提示音两个开关。 */
export function FocusSettings() {
  const prefs = useFocusStore((state) => state.prefs)
  const setPrefs = useFocusStore((state) => state.setPrefs)
  const notifyId = useId()
  const soundId = useId()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="专注设置"
          className="inline-flex size-8 items-center justify-center rounded-[8px] text-(--text-muted) transition-colors duration-(--dur-fast) hover:bg-(--bg-card) hover:text-(--text) focus-visible:outline-2 focus-visible:outline-(--text)"
        >
          <SettingsIcon aria-hidden className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[220px] gap-3 p-4">
        <div className="flex items-center justify-between">
          <Label htmlFor={notifyId}>系统通知</Label>
          <Switch
            id={notifyId}
            checked={prefs.notify}
            onCheckedChange={(notify) => {
              setPrefs({ notify })
              // 打开开关的这一下点击就是请求权限最合适的时机
              if (notify) prepareAlerts({ ...prefs, notify })
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor={soundId}>提示音</Label>
          <Switch
            id={soundId}
            checked={prefs.sound}
            onCheckedChange={(sound) => setPrefs({ sound })}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
