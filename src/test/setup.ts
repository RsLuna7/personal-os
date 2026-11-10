import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver; Radix popovers and tooltips need it.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub
