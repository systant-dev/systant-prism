import { useEffect, useState, type RefObject } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/**
 * The border-box size of the element behind `ref`, rounded to whole px, or null
 * until it is measured (and while `enabled` is false). Only a change in the
 * rounded size re-renders, so sub-pixel layout jitter costs nothing.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>, enabled = true): ElementSize | null {
  const [size, setSize] = useState<ElementSize | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) {
      setSize(null)
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      const { inlineSize, blockSize } = entry.borderBoxSize[0]
      const width = Math.round(inlineSize)
      const height = Math.round(blockSize)
      setSize((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled, ref])

  return size
}
