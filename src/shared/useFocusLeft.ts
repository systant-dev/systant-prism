import { useEffect, useEffectEvent, type RefObject } from 'react'

/**
 * Calls `onLeft` as the focus moves, while `watching`, to anything outside all of
 * `within`: what closes a panel as the keyboard, or a press, takes the focus away from
 * it and whatever opened it. The focus leaving the window is no move: it comes back
 * to where it was.
 */
export function useFocusLeft(watching: boolean, within: readonly RefObject<Element | null>[], onLeft: () => void) {
  const moved = useEffectEvent((to: EventTarget | null) => {
    if (!within.some((ref) => ref.current?.contains(to as Node | null))) onLeft()
  })

  useEffect(() => {
    if (!watching) return
    const follow = (event: FocusEvent) => moved(event.target)
    document.addEventListener('focusin', follow)
    return () => document.removeEventListener('focusin', follow)
  }, [watching])
}
