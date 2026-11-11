import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchPixelRatio } from './watchPixelRatio'

/** A matchMedia whose queries the test changes itself. */
function fakeMedia() {
  const queries: { query: string; listeners: Set<() => void> }[] = []
  vi.stubGlobal('matchMedia', (query: string) => {
    const listeners = new Set<() => void>()
    queries.push({ query, listeners })
    return {
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }
  })
  return {
    queries,
    change: () => [...queries.at(-1)!.listeners].forEach((listener) => listener()),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('watchPixelRatio', () => {
  it('hears the ratio changing', () => {
    const media = fakeMedia()
    const onChange = vi.fn<() => void>()
    watchPixelRatio(onChange)

    media.change()
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('watches for the ratio it is at now, each time it changes', () => {
    const media = fakeMedia()
    vi.stubGlobal('devicePixelRatio', 1)
    watchPixelRatio(() => {})
    vi.stubGlobal('devicePixelRatio', 1.5)
    media.change()

    expect(media.queries.map(({ query }) => query)).toEqual(['(resolution: 1dppx)', '(resolution: 1.5dppx)'])
    expect(media.queries[0].listeners.size).toBe(0)
  })

  it('stops watching', () => {
    const media = fakeMedia()
    const onChange = vi.fn<() => void>()
    const stop = watchPixelRatio(onChange)
    media.change()
    stop()

    expect(media.queries.at(-1)!.listeners.size).toBe(0)
  })

  it('does nothing without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(() => watchPixelRatio(() => {})()).not.toThrow()
  })
})
