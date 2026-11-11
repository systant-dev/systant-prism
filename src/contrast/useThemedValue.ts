import { useEffectEvent, useLayoutEffect, useRef, useState, type DependencyList, type RefObject } from 'react'
import { watchTheme } from './watchTheme'

export interface ThemedValueOptions<T> {
  /** Off, it forgets the value, leaving null. Default true. */
  enabled?: boolean
  /** Off, it keeps the value it has: for an element that needn't keep up but still shows, a popup fading out. Default true. */
  following?: boolean
  /** Whether two reads say the same, so that the first stays and nothing re-renders. Default Object.is. */
  same?: (a: T, b: T) => boolean
}

/**
 * What `read` makes of the element behind `ref`, once it is laid out, read again as its
 * colours may have changed (see watchTheme) and as `deps`, what `read` goes by, change.
 * Null until it is read.
 */
export function useThemedValue<E extends Element, T>(
  ref: RefObject<E | null>,
  read: (el: E) => T | null,
  deps: DependencyList,
  { enabled = true, following = true, same = Object.is }: ThemedValueOptions<T> = {},
): T | null {
  const [value, setValue] = useState<T | null>(null)
  // What it was last given, for a read that says the same to leave as it is.
  const shown = useRef<T | null>(null)
  const readNow = useEffectEvent(read)
  const isSame = useEffectEvent(same)

  useLayoutEffect(() => {
    const el = ref.current
    if (!enabled || !el) {
      shown.current = null
      setValue(null)
      return
    }
    if (!following) return

    const update = () => {
      const next = readNow(el)
      const was = shown.current
      if (was !== null && next !== null && isSame(was, next)) return
      shown.current = next
      setValue(next)
    }
    update()
    return watchTheme(el, update)
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `deps` are what `read` goes by
  }, [ref, enabled, following, ...deps])

  return value
}
