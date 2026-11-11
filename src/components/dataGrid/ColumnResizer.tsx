import { useRef, useState } from 'react'
import { NARROWEST } from './columnWidths'
import { useGridLabels } from './useLabels'

/** How far an arrow key moves a column's edge, in px. */
const KEY_STEP = 16

export interface ColumnResizerProps {
  /** Its column's header, which it is named by. */
  header: string
  /** How wide its column is, in px, where it has a width of its own. */
  width: number | undefined
  /** Makes its column so wide: `anchored` as a pointer drags its edge, which is to stay under the pointer. */
  onResize(width: number, anchored: boolean): void
  /** Makes its column as wide as what is in it. */
  onFit(): void
}

/** Where the handle's column header lies, and which way the columns run: 1 left to right, -1 right to left. */
function place(handle: HTMLElement) {
  const header = handle.parentElement!
  return { box: header.getBoundingClientRect(), across: getComputedStyle(header).direction === 'rtl' ? -1 : 1 }
}

/** How wide the column would be with its far edge at `x`. */
function widthTo(x: number, handle: HTMLElement) {
  const { box, across } = place(handle)
  return across > 0 ? x - box.left : box.right - x
}

// The handle on the far edge of a column's header that changes the column's
// width: dragged, the edge follows the pointer; double-clicked, the column
// fits what is in it. With the focus, the arrow keys move the edge and Enter
// fits, and it is a separator to a screen reader, as a splitter between two
// panes is.
//
// The width is measured from the header's near edge to the pointer as it
// moves, not added up from where the drag began, so it holds as the grid
// scrolls or the columns before it settle under the drag. A drag captures the
// pointer, so it is followed over anything, and ends however the pointer is
// let go, which the browser reports as lost capture. A press that never moves
// changes nothing: it may be half of a double-click.
export function ColumnResizer({ header, width, onResize, onFit }: ColumnResizerProps) {
  const labels = useGridLabels()
  // The pointer dragging it: where it pressed, how far past the column's edge that was, and whether it has moved.
  const drag = useRef<{ pointerId: number; x: number; grip: number; moved: boolean }>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      className="prism-data-grid__resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={labels.resize(header)}
      aria-valuenow={width === undefined ? undefined : Math.round(width)}
      aria-valuemin={NARROWEST}
      title={labels.resizeHint}
      tabIndex={0}
      data-dragging={dragging || undefined}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        const handle = event.currentTarget
        handle.setPointerCapture(event.pointerId)
        const grip = widthTo(event.clientX, handle) - place(handle).box.width
        drag.current = { pointerId: event.pointerId, x: event.clientX, grip, moved: false }
        setDragging(true)
      }}
      onPointerMove={(event) => {
        const from = drag.current
        if (!from || event.pointerId !== from.pointerId) return
        if (!from.moved && event.clientX === from.x) return
        from.moved = true
        onResize(widthTo(event.clientX, event.currentTarget) - from.grip, true)
      }}
      onLostPointerCapture={(event) => {
        if (event.pointerId !== drag.current?.pointerId) return
        drag.current = null
        setDragging(false)
      }}
      // A press on it would select text as it drags.
      onMouseDown={(event) => event.preventDefault()}
      onDoubleClick={onFit}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
        if (!step && event.key !== 'Enter') return
        event.preventDefault()
        if (!step) return onFit()
        // From the width it shows, so the keys don't pile up behind the narrowest it can be.
        const { box, across } = place(event.currentTarget)
        onResize(box.width + step * across * KEY_STEP, false)
      }}
    />
  )
}
