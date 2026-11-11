import { useEffect, useRef, useState } from 'react'

export interface Hold<T> {
  /** What the pointer is holding down, if anything. */
  held: T | null
  /** Holds `value` down until the pointer comes up anywhere, or `release`. */
  hold: (value: T) => void
  release: () => void
}

/**
 * Tracks what the pointer is holding down. It is let go wherever the pointer
 * comes up, not just over what it pressed: listened for from the press itself,
 * so even the quickest click can't let go before it is heard. Letting go, a new
 * hold or unmounting stops listening.
 */
export function useHold<T>(): Hold<T> {
  const [held, setHeld] = useState<T | null>(null)
  const listening = useRef<AbortController | null>(null)

  function release() {
    listening.current?.abort()
    listening.current = null
    setHeld(null)
  }

  function hold(value: T) {
    listening.current?.abort()
    const controller = new AbortController()
    listening.current = controller
    window.addEventListener('pointerup', release, { signal: controller.signal })
    window.addEventListener('pointercancel', release, { signal: controller.signal })
    setHeld(value)
  }

  useEffect(() => () => listening.current?.abort(), [])

  return { held, hold, release }
}
