import { Fragment, useMemo, useState, type CSSProperties, type ReactNode, type Ref, type UIEvent } from 'react'
import { ScrollArea } from '../scroll'
import { useElementSize, useForwardedRef } from '../../shared'
import { stack, visibleRange } from './virtualWindow'

/** How much is drawn before the view is measured (and on a server): a tall window's worth. */
const UNMEASURED_HEIGHT = 800

/** How many items are drawn past each end of the view. */
const OVERSCAN = 4

/**
 * Whether an item's props are the same as last time, for memo: its style, which
 * is made anew each time it is drawn, by where it is placed, and the rest as
 * they are.
 */
export function sameItemProps<P extends { style: CSSProperties }>(previous: P, next: P) {
  const keys = Object.keys(next) as (keyof P)[]
  return (
    keys.length === Object.keys(previous).length &&
    keys.every((key) =>
      key === 'style'
        ? previous.style.top === next.style.top && previous.style.height === next.style.height
        : Object.is(previous[key], next[key]),
    )
  )
}

export interface VirtualRowsProps<T> {
  items: readonly T[]
  heightOf(item: T): number
  keyOf(item: T): string
  /** Draws an item, which must take `style`: it places the item in the list. */
  render(item: T, style: CSSProperties): ReactNode
  /** Shown in place of the list while it has no items. */
  empty?: ReactNode
  onScroll?(event: UIEvent<HTMLDivElement>): void
  /** The element that scrolls, to scroll it from outside. */
  viewportRef?: Ref<HTMLDivElement>
}

// A list that scrolls in a ScrollArea and draws only the items in view, each
// laid at its offset in a box as tall as them all, so a long list costs no
// more to scroll than a short one. Items have known heights, so nothing need
// be measured but the view.
export function VirtualRows<T>({ items, heightOf, keyOf, render, empty, onScroll, viewportRef }: VirtualRowsProps<T>) {
  const viewport = useForwardedRef(viewportRef)
  const size = useElementSize(viewport)
  const [top, setTop] = useState(0)

  const offsets = useMemo(() => stack(items.map(heightOf)), [items, heightOf])
  const height = size?.height ?? UNMEASURED_HEIGHT
  const { start, end } = visibleRange(offsets, top, height, OVERSCAN)

  return (
    <ScrollArea
      axis="both"
      className="prism-data-grid__body"
      viewportRef={viewport}
      // In the tab order, so the keyboard can scroll it: its rows needn't hold anything that takes focus.
      viewportProps={{ tabIndex: 0, className: 'prism-data-grid__viewport' }}
      onScroll={(event) => {
        // Drawn again only as items come into view or leave it, not for every pixel scrolled.
        const next = event.currentTarget.scrollTop
        const range = visibleRange(offsets, next, height, OVERSCAN)
        if (range.start !== start || range.end !== end) setTop(next)
        onScroll?.(event)
      }}
    >
      {items.length ? (
        <div className="prism-data-grid__rows" role="rowgroup" style={{ height: offsets.at(-1) }}>
          {items.slice(start, end).map((item, i) => (
            <Fragment key={keyOf(item)}>
              {render(item, { top: offsets[start + i], height: offsets[start + i + 1] - offsets[start + i] })}
            </Fragment>
          ))}
        </div>
      ) : (
        empty
      )}
    </ScrollArea>
  )
}
