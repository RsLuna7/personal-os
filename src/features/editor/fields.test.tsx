import { renderHook } from '@testing-library/react'
import { useAnchorElement } from './fields'

const SELECTOR = '[data-testid="target"]'

function addTarget(): HTMLElement {
  const element = document.createElement('div')
  element.dataset.testid = 'target'
  document.body.appendChild(element)
  return element
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useAnchorElement', () => {
  it('finds the element by selector', () => {
    const target = addTarget()
    const { result } = renderHook(() => useAnchorElement(null, SELECTOR))
    expect(result.current).toBe(target)
  })

  it('returns a given anchor as it is', () => {
    addTarget()
    const anchor = document.createElement('span')
    const { result } = renderHook(() => useAnchorElement(anchor, SELECTOR))
    expect(result.current).toBe(anchor)
  })

  it('returns null until the element exists, then picks it up on the next render', () => {
    const { result, rerender } = renderHook(() => useAnchorElement(null, SELECTOR))
    expect(result.current).toBeNull()
    const target = addTarget()
    rerender()
    expect(result.current).toBe(target)
  })

  it('switches to the new element when the remembered one was removed', () => {
    const first = addTarget()
    const { result, rerender } = renderHook(() => useAnchorElement(null, SELECTOR))
    expect(result.current).toBe(first)
    first.remove()
    const second = addTarget()
    rerender()
    expect(result.current).toBe(second)
    expect(result.current?.isConnected).toBe(true)
  })
})
