import {
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react'
import { BackdropContext } from '../backdrop'

export interface ResizeHandle {
  /** The size to give the target's style, once it has been resized; null until then. */
  style: CSSProperties | null
  /** For the handle. */
  handlers: {
    onPointerDown(event: PointerEvent<HTMLElement>): void
    onPointerMove(event: PointerEvent): void
    onLostPointerCapture(event: PointerEvent): void
    onMouseDown(event: MouseEvent): void
    onKeyDown(event: KeyboardEvent): void
  }
}

// How far an arrow key moves the handle.
const KEY_STEP = 16

const KEYS: Record<string, [x: number, y: number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/**
 * Makes an element into a handle that resizes `targetRef`'s element from its
 * corner at the end of the bottom edge: by dragging it, or with the arrow keys
 * while it has the focus. The handle lies at the bottom right, or the bottom
 * left in text that runs right to left, where moving it right narrows the
 * target. It is never wider than what it is in, and the target's own CSS limits
 * hold it too: keys start from the size it really came to, so they don't pile up
 * behind a limit. What it is in must have a width of its own, not one taken from
 * its content, or that 100% holds it to what it already is.
 *
 * A drag captures the pointer, so it is followed over anything, an iframe
 * included, and ends however the pointer is let go: the browser reports that as
 * lost capture after pointerup and pointercancel alike.
 *
 * A press on the handle leaves the focus where it was, so a resize doesn't bring
 * up a phone's keyboard. Inside a GlassBackdrop it redraws as the size changes:
 * what lies after the target moves, and what shows behind it changes.
 */
export function useResizeHandle(targetRef: RefObject<HTMLElement | null>): ResizeHandle {
  const backdrop = useContext(BackdropContext)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const dragFrom = useRef<ReturnType<typeof measure> & { pointerId: number; x: number; y: number }>(null)

  useEffect(() => {
    if (size) backdrop?.invalidate()
  }, [backdrop, size])

  // A width alone would widen a track sized to its content, leaving nothing for
  // the target's max-width of 100% to hold it to. A percentage counts for nothing
  // in sizing the track, and is then measured against it.
  // Never below 0, which CSS would throw out, putting the size back to what it was before any resize.
  const style = size && { width: `min(100%, ${Math.max(0, size.width)}px)`, height: Math.max(0, size.height) }

  function measure() {
    const el = targetRef.current!
    const { width, height } = el.getBoundingClientRect()
    return { width, height, across: getComputedStyle(el).direction === 'rtl' ? -1 : 1 }
  }

  return {
    style,
    handlers: {
      onPointerDown(event) {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        dragFrom.current = { ...measure(), pointerId: event.pointerId, x: event.clientX, y: event.clientY }
      },

      onPointerMove(event) {
        const from = dragFrom.current
        if (!from || event.pointerId !== from.pointerId) return
        setSize({
          width: from.width + (event.clientX - from.x) * from.across,
          height: from.height + event.clientY - from.y,
        })
      },

      onLostPointerCapture(event) {
        if (event.pointerId === dragFrom.current?.pointerId) dragFrom.current = null
      },

      // A press on it would select text as it drags, and focus it or, through the pill, the field.
      onMouseDown(event) {
        event.preventDefault()
        event.stopPropagation()
      },

      onKeyDown(event) {
        const key = KEYS[event.key]
        if (!key || event.altKey || event.ctrlKey || event.metaKey) return
        event.preventDefault()
        const { width, height, across } = measure()
        setSize({ width: width + key[0] * across * KEY_STEP, height: height + key[1] * KEY_STEP })
      },
    },
  }
}
