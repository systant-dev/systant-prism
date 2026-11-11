import { useLayoutEffect, useState } from 'react'

export interface OptionRefs<T, E extends HTMLElement = HTMLDivElement> {
  /** The entries' elements, by value. */
  options: ReadonlyMap<T, E>
  /** The ref callback for an entry: the same one on every render. */
  optionRef: (value: T) => (el: E | null) => void
}

/**
 * Keeps each entry's element, by value. Each entry gets one ref callback, kept
 * across renders, so React doesn't detach and reattach every entry on every
 * render. A callback is let go once its entry is no longer listed, after React
 * has detached it, so a list whose entries keep changing doesn't collect them.
 */
export function useOptionRefs<T, E extends HTMLElement = HTMLDivElement>(values: readonly T[]): OptionRefs<T, E> {
  // Held in state rather than refs, as rendering hands out the callbacks.
  const [options] = useState(() => new Map<T, E>())
  const [callbacks] = useState(() => new Map<T, (el: E | null) => void>())

  useLayoutEffect(() => {
    if (callbacks.size === values.length) return
    const listed = new Set(values)
    for (const value of callbacks.keys()) {
      if (!listed.has(value)) callbacks.delete(value)
    }
  })

  function optionRef(value: T) {
    let attach = callbacks.get(value)
    if (!attach) {
      attach = (el) => {
        if (el) options.set(value, el)
        else options.delete(value)
      }
      callbacks.set(value, attach)
    }
    return attach
  }

  return { options, optionRef }
}
