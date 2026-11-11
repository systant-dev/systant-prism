import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * `handler` as a function that stays the same from render to render, but calls
 * whichever `handler` the last render gave: so a memoised child handed it isn't
 * drawn again for a handler made anew, and a listener or timer that outlives its
 * render never calls one that is out of date. It is for events, not for calling
 * while rendering.
 */
export function useHandler<A extends unknown[], R>(handler: (...args: A) => R): (...args: A) => R {
  const latest = useRef(handler)
  useLayoutEffect(() => {
    latest.current = handler
  })
  return useCallback((...args: A) => latest.current(...args), [])
}
