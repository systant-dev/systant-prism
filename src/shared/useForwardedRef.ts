import { useImperativeHandle, useRef, type Ref, type RefObject } from 'react'

/**
 * A ref of a component's own for its element, which it also hands on to
 * `ref`, the one it was given, as React does: including a callback ref that
 * returns a cleanup.
 */
export function useForwardedRef<T>(ref: Ref<T> | undefined): RefObject<T | null> {
  const inner = useRef<T>(null)
  useImperativeHandle(ref, () => inner.current!, [])
  return inner
}
