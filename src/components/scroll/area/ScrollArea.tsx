import { useLayoutEffect, useRef, type ComponentProps, type Ref } from 'react'
import { cornerStyles, cx, PrismStyles, useForwardedRef } from '../../../shared'
import { scrollAreaStyles } from './ScrollArea.styles'
import { scrollbarStyles } from './scrollbar.styles'
import { watchScrollbars, type BarAxis } from './scrollbars'
import { useScrollFade } from '../fade'

export type ScrollAxis = 'y' | 'x' | 'both'

export interface ScrollAreaProps extends ComponentProps<'div'> {
  /** Which way the content scrolls; the other way it is clipped. */
  axis?: ScrollAxis
  /** Fade the content out where it is cut off. */
  fade?: boolean
  /** The viewport: the element that scrolls, for scrollTo and the like. */
  viewportRef?: Ref<HTMLDivElement>
  /**
   * Props for the viewport, the element that scrolls and is focused to scroll
   * by keyboard: an aria-label, say, or tabIndex={0} where nothing inside can
   * take focus, as Safari won't focus the scroller itself.
   */
  viewportProps?: Omit<ComponentProps<'div'>, 'children' | 'ref' | 'onScroll'>
}

const AXIS_BARS: Record<ScrollAxis, BarAxis[]> = {
  y: ['y'],
  x: ['x'],
  both: ['y', 'x'],
}

// A box whose content scrolls behind thin glass scrollbars (scrollbar.styles.ts)
// and fades out where it is cut off (useScrollFade). The scrollbars are bars of
// their own laid over the viewport (scrollbars.ts), inset from its corners so
// their ends clear a card's rounded ones, while the content still runs the
// viewport's full length.
//
// Props go to the area, the box laid out in the page; its children go in the
// viewport, which fills it and scrolls, so give the area a height (or a flex or
// max- height) and put any padding on a child. onScroll and viewportProps are
// the viewport's: the area itself never scrolls. See ScrollArea.styles.ts for
// the layout and focus ring.
export function ScrollArea({
  axis = 'y',
  fade = true,
  viewportRef,
  viewportProps,
  className,
  onScroll,
  children,
  ref,
  ...rest
}: ScrollAreaProps) {
  const area = useForwardedRef(ref)
  const viewport = useForwardedRef(viewportRef)
  const bars = useRef<Partial<Record<BarAxis, HTMLDivElement | null>>>({})
  const fading = useScrollFade(viewport, fade)

  useLayoutEffect(() => {
    const areaEl = area.current!
    const own = Object.fromEntries(AXIS_BARS[axis].map((a) => [a, bars.current[a]!]))
    const scrollbars = watchScrollbars(viewport.current!, own, (native) =>
      areaEl.toggleAttribute('data-native-scrollbars', native),
    )
    return scrollbars.stop
  }, [axis, area, viewport])

  return (
    <>
      <PrismStyles href="prism-corners" css={cornerStyles} />
      <PrismStyles href="prism-scrollbar" css={scrollbarStyles} />
      <PrismStyles href="prism-scroll-area" css={scrollAreaStyles} />
      {fading.element}
      <div ref={area} className={cx('prism-scroll-area', `prism-scroll-area--${axis}`, className)} {...rest}>
        <div
          {...viewportProps}
          ref={viewport}
          className={cx('prism-scroll-area__viewport', 'prism-scrollbar', fading.className, viewportProps?.className)}
          onScroll={onScroll}
        >
          {children}
        </div>
        {/* Hidden from the accessibility tree and Tab: the viewport scrolls */}
        {AXIS_BARS[axis].map((a) => (
          <div
            key={a}
            ref={(el) => {
              bars.current[a] = el
            }}
            className={`prism-scroll-area__bar prism-scroll-area__bar--${a} prism-scrollbar`}
            tabIndex={-1}
            aria-hidden="true"
          >
            <div className="prism-scroll-area__extent" />
          </div>
        ))}
      </div>
    </>
  )
}
