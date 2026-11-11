import { watchScroll } from '../watchScroll'

export type BarAxis = 'x' | 'y'

// The DOM's names for a length and position along each axis.
const ALONG = {
  y: { scroll: 'scrollHeight', client: 'clientHeight', pos: 'scrollTop', length: 'height' },
  x: { scroll: 'scrollWidth', client: 'clientWidth', pos: 'scrollLeft', length: 'width' },
} as const

/** A running watchScrollbars. */
export interface Scrollbars {
  /** Stops watching. */
  stop(): void
  /** Measures again, for a change nothing reports: the text of a <textarea>, say. */
  refresh(): void
}

interface Wrote {
  viewport: number
  bar: number
}

/** Whether `side` is where it was last scrolled to (within a px, as it may round); hears that once. */
function echoed(wrote: Wrote, side: keyof Wrote, pos: number) {
  const echo = Math.abs(pos - wrote[side]) < 1
  wrote[side] = NaN
  return echo
}

/**
 * Drives ScrollArea's bars: each is a scroller of its own, shorter than the
 * viewport so its ends clear rounded corners, holding
 * one child sized so its thumb is in proportion to the viewport's content, as
 * a scrollbar on the viewport would be. Scrolling either one scrolls the other
 * to match. Where scrollbars overlay the content rather than taking space (the
 * bars come out 0 thick), `native` is called with true and the bars are hidden,
 * for the viewport to show its own.
 */
export function watchScrollbars(
  viewport: HTMLElement,
  bars: Partial<Record<BarAxis, HTMLElement>>,
  native: (native: boolean) => void,
): Scrollbars {
  const axes = (Object.keys(bars) as BarAxis[]).filter((axis) => bars[axis])
  // How far a bar scrolls per px the viewport does: its length over the viewport's.
  const scale = (axis: BarAxis) => {
    const a = ALONG[axis]
    return viewport[a.client] ? bars[axis]![a.client] / viewport[a.client] : 0
  }
  // How thick a bar's scrollbar is: what it takes across the bar.
  const thickness = (axis: BarAxis) => {
    const bar = bars[axis]!
    return axis === 'y' ? bar.offsetWidth - bar.clientWidth : bar.offsetHeight - bar.clientHeight
  }
  let wasNative: boolean | null = null
  // Where each side was last scrolled to by the other, so the scroll that sets
  // off isn't echoed back: a scroll is smooth, and writing the side that is
  // still gliding would stop it a px or so in.
  const wrote = Object.fromEntries(axes.map((axis) => [axis, { viewport: NaN, bar: NaN }])) as Record<BarAxis, Wrote>

  function layOut() {
    const isNative = axes.some((axis) => thickness(axis) <= 0)
    if (isNative !== wasNative) native((wasNative = isNative))

    for (const axis of axes) {
      const a = ALONG[axis]
      const bar = bars[axis]!
      const k = scale(axis)
      const overflows = viewport[a.scroll] - viewport[a.client] >= 1
      bar.style.visibility = overflows && !isNative ? '' : 'hidden'
      ;(bar.firstElementChild as HTMLElement).style[a.length] = `${viewport[a.scroll] * k}px`
      if (echoed(wrote[axis], 'viewport', viewport[a.pos])) continue
      const pos = viewport[a.pos] * k
      if (Math.abs(bar[a.pos] - pos) >= 0.5) {
        bar[a.pos] = pos
        wrote[axis].bar = bar[a.pos]
      }
    }
  }

  const follow = axes.map((axis) => {
    const a = ALONG[axis]
    const bar = bars[axis]!
    const onScroll = () => {
      if (echoed(wrote[axis], 'bar', bar[a.pos])) return
      const k = scale(axis)
      const pos = k ? bar[a.pos] / k : 0
      if (Math.abs(viewport[a.pos] - pos) >= 0.5) {
        viewport[a.pos] = pos
        wrote[axis].viewport = viewport[a.pos]
      }
    }
    bar.addEventListener('scroll', onScroll, { passive: true })
    return () => bar.removeEventListener('scroll', onScroll)
  })

  layOut()
  const stop = watchScroll(viewport, layOut)
  // A bar's length changes with the area's, which the viewport's resize reports too.
  return {
    stop() {
      stop()
      for (const unfollow of follow) unfollow()
    },
    refresh: layOut,
  }
}
