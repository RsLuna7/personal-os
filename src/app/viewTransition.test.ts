import { runViewTransition, transitionBetween } from './viewTransition'

describe('transitionBetween', () => {
  it('expands from home to the timeline and collapses back', () => {
    expect(transitionBetween('home', 'timeline')).toBe('expand')
    expect(transitionBetween('timeline', 'home')).toBe('collapse')
  })

  it('has no transition between other pages', () => {
    expect(transitionBetween('home', 'calendar')).toBeNull()
    expect(transitionBetween('calendar', 'timeline')).toBeNull()
    expect(transitionBetween('timeline', 'timeline')).toBeNull()
  })
})

describe('runViewTransition', () => {
  const root = document.documentElement
  let original: Document['startViewTransition'] | undefined

  beforeEach(() => {
    original = document.startViewTransition
    vi.useFakeTimers()
  })
  afterEach(() => {
    if (original) document.startViewTransition = original
    else delete (document as Partial<Document>).startViewTransition
    vi.unstubAllGlobals()
    vi.useRealTimers()
    delete root.dataset.vt
    delete root.dataset.timelineEnter
  })

  function stubTransition() {
    const start = vi.fn((callback?: () => void) => {
      callback?.()
      return {
        ready: new Promise<void>(() => {}),
        finished: new Promise<void>(() => {}),
      } as unknown as ViewTransition
    })
    document.startViewTransition = start as unknown as Document['startViewTransition']
    return start
  }

  it('switches straight away when the browser has no view transitions', () => {
    delete (document as Partial<Document>).startViewTransition
    const update = vi.fn()
    runViewTransition('expand', update)
    expect(update).toHaveBeenCalledOnce()
    expect(root.dataset.vt).toBeUndefined()
  })

  it('switches straight away when reduced motion is on', () => {
    const start = stubTransition()
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
    const update = vi.fn()
    runViewTransition('expand', update)
    expect(update).toHaveBeenCalledOnce()
    expect(start).not.toHaveBeenCalled()
    expect(root.dataset.timelineEnter).toBeUndefined()
  })

  it('marks an expand so the today line and bars can play their entrance', () => {
    const start = stubTransition()
    const update = vi.fn()
    runViewTransition('expand', update)
    expect(start).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledOnce()
    expect(root.dataset.vt).toBe('expand')
    expect(root.dataset.timelineEnter).toBe('true')
    vi.advanceTimersByTime(1400)
    expect(root.dataset.timelineEnter).toBeUndefined()
  })

  it('does not play the entrance when collapsing', () => {
    stubTransition()
    runViewTransition('collapse', vi.fn())
    expect(root.dataset.vt).toBe('collapse')
    expect(root.dataset.timelineEnter).toBeUndefined()
  })
})
