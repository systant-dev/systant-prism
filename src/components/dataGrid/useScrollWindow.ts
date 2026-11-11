import { useId, useLayoutEffect, useRef, useState, type FocusEvent, type RefObject, type UIEvent } from 'react'
import { useScrollEdges } from '../scroll'
import { useElementSize } from '../../shared'

/**
 * Whether the browser moves the columns by the body's scroll timeline itself,
 * in step with the scroll (DataGrid.styles.ts); where it can't, a script does,
 * as the body scrolls.
 */
function hasScrollTimelines() {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('(animation-timeline: scroll()) and (timeline-scope: none)')
  )
}

export interface ScrollWindow {
  /** For the table, whose styles it writes, and the body, the element that scrolls. */
  table: RefObject<HTMLDivElement | null>
  body: RefObject<HTMLDivElement | null>
  /** A name for the body's scroll timeline that no other grid on the page has, a child grid's included. */
  timeline: string
  /** Whether the body has been measured as having any width: not yet, or not while the grid is hidden. */
  laidOut: boolean
  /** For the body's scroll: moves the columns where the browser can't by its scroll timeline. */
  onScroll(event: UIEvent<HTMLDivElement>): void
  /** For the focus moving into the header: scrolls the body to a filter outside the window. */
  reveal(event: FocusEvent<HTMLElement>): void
  /** Scrolls the body back to its top, as a new sort, filter, page or row starts there. */
  toTop(): void
}

/**
 * The window the columns show through as the body scrolls (see
 * DataGrid.styles.ts): what the table's styles need of the body, written as it
 * changes (how far it fades at its sides, and how wide it is), and the
 * handlers for the body's scroll and the header's focus.
 */
export function useScrollWindow(): ScrollWindow {
  const table = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  // Asked once, as it mounts: it doesn't change.
  const [scrollTimelines] = useState(hasScrollTimelines)
  const timeline = `--prism-data-grid-${useId().replace(/[^\w-]/g, '')}`

  // The header and summary row fade at the sides as far as the body does, so the columns fade out together.
  useScrollEdges(body, (fade) => {
    table.current?.style.setProperty('--_prism-data-grid-fade-left', `${fade.left}px`)
    table.current?.style.setProperty('--_prism-data-grid-fade-right', `${fade.right}px`)
  })

  // The window follows the body's width: read straight from the body until a
  // ResizeObserver first reports (which it never does in a page drawing no frames).
  const bodySize = useElementSize(body)
  useLayoutEffect(() => {
    const width = bodySize?.width ?? body.current?.clientWidth
    if (width !== undefined) table.current?.style.setProperty('--_prism-data-grid-width', `${width}px`)
  }, [bodySize])

  return {
    table,
    body,
    timeline,
    laidOut: (bodySize?.width ?? 0) > 0,
    onScroll: (event) => {
      if (!scrollTimelines) {
        table.current?.style.setProperty('--_prism-data-grid-scroll', `${event.currentTarget.scrollLeft}px`)
      }
    },
    // The header doesn't scroll: the focus moving to a filter outside the window
    // scrolls the body to it, which moves the header's columns with its own.
    reveal: (event) => {
      const viewport = body.current
      const cell = (event.target as HTMLElement).closest<HTMLElement>('[role="columnheader"]')
      const window = cell?.closest<HTMLElement>('.prism-data-grid__cells')
      if (!viewport || !cell || !window) return
      // Where the cell lies on its track, which the body's scroll moves one for one.
      const left = cell.offsetLeft
      const right = left + cell.offsetWidth
      if (left < viewport.scrollLeft) viewport.scrollLeft = left
      else if (right > viewport.scrollLeft + window.clientWidth) viewport.scrollLeft = right - window.clientWidth
    },
    toTop: () => {
      if (body.current) body.current.scrollTop = 0
    },
  }
}
