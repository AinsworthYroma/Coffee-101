import { vi } from 'vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => {
    const target = new EventTarget()
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: target.addEventListener.bind(target, 'change'),
      removeListener: target.removeEventListener.bind(target, 'change'),
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    }
  }),
})

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

Object.defineProperty(document, 'fonts', {
  value: { load: () => Promise.resolve([]) },
})

Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
  value: () => 0,
})
