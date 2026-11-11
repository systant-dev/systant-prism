import { useLayoutEffect, useRef, type RefObject } from 'react'
import { NO_EDGES, sameEdges, scrollFade, type Edges } from '../../../shared'
import { watchScroll } from '../watchScroll'

/**
 * Measures the scroller behind `ref` whenever what it shows may have changed
 * (watchScroll), and calls `onChange` with how far in from each edge its
 * content fades, in px (scrollFade in src/shared/scrollEdges.ts), when that
 * differs from the last call: once on mount, before the first paint, and while
 * scrolling only as a fade ramps in or out, never for every scrolled frame in
 * between. It only reports; what to do with the fade is up to `onChange`, which
 * may change between renders. `ref` is checked after every render, so a
 * scroller swapped for another is followed.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>, onChange: (fade: Edges) => void, enabled = true) {
  const changed = useRef(onChange)
  const watching = useRef<{ el: HTMLElement; stop: () => void } | null>(null)

  useLayoutEffect(() => {
    changed.current = onChange

    const el = enabled ? ref.current : null
    if (watching.current?.el === el) return
    stopWatching(watching)
    if (!el) return

    // Live: always the element's current computed style.
    const computed = getComputedStyle(el)
    let last: Edges | null = null

    function measure() {
      const fade = scrollFade(el!, computed)
      if (last && sameEdges(last, fade)) return
      last = fade
      changed.current(fade)
    }

    measure()
    const stop = watchScroll(el, measure)
    watching.current = {
      el,
      stop() {
        stop()
        changed.current(NO_EDGES)
      },
    }
  })

  useLayoutEffect(() => () => stopWatching(watching), [])
}

function stopWatching(watching: RefObject<{ stop: () => void } | null>) {
  watching.current?.stop()
  watching.current = null
}
