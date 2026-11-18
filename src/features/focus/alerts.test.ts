import { toast } from 'sonner'
import { announce, eventText, FRESH_EVENT_MS, prepareAlerts } from './alerts'
import { DEFAULT_PREFS } from './focusStore'
import { startRun, type TimerEvent } from './timer'

vi.mock('sonner', () => ({ toast: vi.fn() }))

const NOW = Date.UTC(2026, 10, 18, 2, 0, 0)
const run = startRun({ mode: 'pomodoro', tag: '学习', note: '', focusMin: 25, breakMin: 5 }, NOW)
const done: TimerEvent = { type: 'focus-done', at: NOW }

let created: { title: string; options: NotificationOptions }[]
let oscillators: number

function stubBrowser(permission: NotificationPermission) {
  created = []
  oscillators = 0
  const request = vi.fn(async () => 'granted' as const)
  class FakeNotification {
    static permission = permission
    static requestPermission = request
    onclick: (() => void) | null = null
    constructor(title: string, options: NotificationOptions) {
      created.push({ title, options })
    }
    close() {}
  }
  class FakeAudio {
    currentTime = 0
    destination = {}
    resume = vi.fn()
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect: (next: unknown) => next,
      }
    }
    createOscillator() {
      oscillators++
      return {
        type: '',
        frequency: { value: 0 },
        connect: (next: unknown) => next,
        start() {},
        stop() {},
      }
    }
  }
  vi.stubGlobal('Notification', FakeNotification)
  vi.stubGlobal('AudioContext', FakeAudio)
  return request
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(toast).mockClear()
})

describe('announce', () => {
  it('shows a message, plays the chime and sends a system notification', () => {
    stubBrowser('granted')
    announce([done], run, DEFAULT_PREFS, NOW + 2000)
    expect(toast).toHaveBeenCalledWith('专注完成 · 学习', { description: '休息 5 分钟' })
    expect(oscillators).toBeGreaterThan(0)
    expect(created).toEqual([
      {
        title: '专注完成 · 学习',
        options: expect.objectContaining({ body: '休息 5 分钟', silent: true }),
      },
    ])
  })

  it('stays quiet when the sound is switched off', () => {
    stubBrowser('granted')
    announce([done], run, { ...DEFAULT_PREFS, sound: false }, NOW)
    expect(oscillators).toBe(0)
    expect(created).toHaveLength(1)
  })

  it('sends no system notification when it is switched off or not allowed', () => {
    stubBrowser('granted')
    announce([done], run, { ...DEFAULT_PREFS, notify: false }, NOW)
    expect(created).toEqual([])
    stubBrowser('denied')
    announce([done], run, DEFAULT_PREFS, NOW)
    expect(created).toEqual([])
    stubBrowser('default')
    announce([done], run, DEFAULT_PREFS, NOW)
    expect(created).toEqual([])
  })

  it('does not bother you about things that ended long ago (caught up after a reload)', () => {
    stubBrowser('granted')
    announce([done], run, DEFAULT_PREFS, NOW + FRESH_EVENT_MS + 1)
    expect(toast).not.toHaveBeenCalled()
    expect(created).toEqual([])
    expect(oscillators).toBe(0)
  })

  it('only announces the latest of several events', () => {
    stubBrowser('granted')
    const events: TimerEvent[] = [done, { type: 'break-done', at: NOW + 1000 }]
    announce(events, run, DEFAULT_PREFS, NOW + 2000)
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('休息结束', { description: '开始下一轮 · 学习' })
  })

  it('does nothing without events or without a run', () => {
    stubBrowser('granted')
    announce([], run, DEFAULT_PREFS, NOW)
    announce([done], null, DEFAULT_PREFS, NOW)
    expect(toast).not.toHaveBeenCalled()
  })

  it('does not fail where there is no Notification or audio', () => {
    vi.stubGlobal('Notification', undefined)
    vi.stubGlobal('AudioContext', undefined)
    expect(() => announce([done], run, DEFAULT_PREFS, NOW)).not.toThrow()
    expect(() => prepareAlerts(DEFAULT_PREFS)).not.toThrow()
  })
})

describe('prepareAlerts', () => {
  it('asks for permission the first time only', () => {
    const request = stubBrowser('default')
    prepareAlerts(DEFAULT_PREFS)
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('does not ask again once decided, or when notifications are off', () => {
    const granted = stubBrowser('granted')
    prepareAlerts(DEFAULT_PREFS)
    expect(granted).not.toHaveBeenCalled()
    const denied = stubBrowser('denied')
    prepareAlerts(DEFAULT_PREFS)
    expect(denied).not.toHaveBeenCalled()
    const off = stubBrowser('default')
    prepareAlerts({ ...DEFAULT_PREFS, notify: false })
    expect(off).not.toHaveBeenCalled()
  })
})

describe('eventText', () => {
  it('names the tag and the break', () => {
    expect(eventText(done, run)).toEqual({ title: '专注完成 · 学习', body: '休息 5 分钟' })
    expect(eventText({ type: 'break-done', at: NOW }, run)).toEqual({
      title: '休息结束',
      body: '开始下一轮 · 学习',
    })
  })
})
