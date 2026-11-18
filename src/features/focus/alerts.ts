import { toast } from 'sonner'
import type { FocusPrefs } from './focusStore'
import type { RunState, TimerEvent } from './timer'

/** 页面一直开着时，事件和“现在”只差几秒；隔得更久（关掉页面后补算出来的）就不再打扰。 */
export const FRESH_EVENT_MS = 5 * 60_000

let audio: AudioContext | null = null

/** 浏览器要求先有一次点击才让出声：开始计时的那一下顺手准备好。 */
export function unlockAudio(): void {
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch {
    // 没有 Web Audio 就没有提示音
  }
}

/** 一声轻提示：两个柔和的音，不带音频文件。 */
export function playChime(): void {
  try {
    unlockAudio()
    if (!audio) return
    const start = audio.currentTime
    ;[784, 1047].forEach((frequency, index) => {
      const osc = audio!.createOscillator()
      const gain = audio!.createGain()
      const at = start + index * 0.18
      osc.type = 'sine'
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.7)
      osc.connect(gain).connect(audio!.destination)
      osc.start(at)
      osc.stop(at + 0.75)
    })
  } catch {
    // 出不了声就算了
  }
}

/** 第一次开始时请求系统通知权限；只在还没决定、设置里也没关通知时问一次。 */
export function prepareAlerts(prefs: FocusPrefs): void {
  unlockAudio()
  if (
    prefs.notify &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default'
  ) {
    try {
      void Notification.requestPermission()
    } catch {
      // 旧浏览器的写法不同，不影响计时
    }
  }
}

function systemNotify(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    // silent：声音由我们自己的提示音负责，开关才管用
    const note = new Notification(title, { body, tag: 'kairos-focus', silent: true })
    note.onclick = () => {
      window.focus()
      note.close()
    }
  } catch {
    // 有些环境（手机浏览器）不允许直接创建通知
  }
}

export function eventText(event: TimerEvent, run: RunState): { title: string; body: string } {
  if (event.type === 'focus-done') {
    return {
      title: `专注完成 · ${run.tag}`,
      body: run.breakMs > 0 ? `休息 ${Math.round(run.breakMs / 60_000)} 分钟` : '',
    }
  }
  return { title: '休息结束', body: `开始下一轮 · ${run.tag}` }
}

/** 专注或休息到点：页面提示、系统通知、提示音。 */
export function announce(
  events: TimerEvent[],
  run: RunState | null,
  prefs: FocusPrefs,
  now: number,
): void {
  const fresh = events.filter((event) => now - event.at <= FRESH_EVENT_MS)
  const last = fresh.at(-1)
  if (!last || !run) return
  const { title, body } = eventText(last, run)
  toast(title, { description: body || undefined })
  if (prefs.sound) playChime()
  if (prefs.notify) systemNotify(title, body)
}
