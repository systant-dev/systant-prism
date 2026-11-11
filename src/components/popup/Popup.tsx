import { useEffectEvent, useLayoutEffect, type ComponentProps, type RefObject } from 'react'
import { BackdropContext, useGlassText } from '../backdrop'
import type { CardPadding } from '../card'
import { cardStyles } from '../card'
import { useEdgeLight } from '../../effects/edgeLight'
import { useRim } from '../../effects/rim'
import {
  cornerStyles,
  cssVars,
  cx,
  motionStyles,
  PrismStyles,
  readCssNumber,
  readCssTime,
  reducedMotion,
  useElementSize,
  useForwardedRef,
} from '../../shared'
import { placePopup, unscaledRect, type PopupAlign, type PopupSide } from './placePopup'
import { popupStyles } from './Popup.styles'
import { usePopupGlass } from './usePopupGlass'

/** An element to open beside, or a point in viewport px (a pointer's clientX and clientY) to open at. */
export type PopupAnchor = RefObject<HTMLElement | null> | { x: number; y: number }

export interface PopupProps extends Omit<ComponentProps<'div'>, 'popover'> {
  /** Whether it shows. It fades in and out as this changes. */
  open: boolean
  /** Called when it asks to close: on Escape, or a press outside it and its anchor element. */
  onClose?: () => void
  /** What it opens beside or at. */
  anchor: PopupAnchor
  /** Which side of the anchor it opens on, if it fits there. */
  side?: PopupSide
  /** How it lines up along the anchor. */
  align?: PopupAlign
  /** The gap between it and the anchor, in px. 8 beside an element, 0 at a point. */
  offset?: number
  /** Moves it along the anchor from where `align` puts it, in px: in from that edge, or out past it below 0. */
  alignOffset?: number
  padding?: CardPadding
  /** Light the rim from the pointer position, as a card's border is. */
  highlight?: boolean
  /** Glass: inside a GlassBackdrop, the image behind the popup, blurred and bent at the edges. */
  refract?: boolean
  /** Take the page's text colour inside a GlassBackdrop, and stay readable (WCAG AA) on an opaque background. */
  readableText?: boolean
}

/** The least gap between a popup and the edge of the viewport, in px. */
const MARGIN = 8

// The open popups, the latest last, and every popup after any it is inside.
// Escape closes only the last, so a submenu closes before the menu it came from.
const stack: HTMLElement[] = []

/** Which way a popup on each side lies from its anchor, as a translate of 1px towards it. */
const TOWARDS_ANCHOR: Record<PopupSide, [number, number]> = {
  bottom: [0, -1],
  top: [0, 1],
  right: [-1, 0],
  left: [1, 0],
}

/**
 * Slides a popup that has just opened in from its anchor, by --prism-popup-slide,
 * on the timing of its fade in (see Popup.styles.ts). It is placed only once
 * shown, too late for @starting-style to know which side it is on, so this is
 * an animation of its own. Returns it, or null with prefers-reduced-motion or
 * no Web Animations API.
 */
function slideIn(el: HTMLElement, side: PopupSide) {
  if (typeof el.animate !== 'function' || reducedMotion()) return null
  const computed = getComputedStyle(el)
  const distance = readCssNumber(computed, '--prism-popup-slide', 0)
  const duration = readCssTime(computed.getPropertyValue('--prism-popup-in-duration'))
  if (distance <= 0 || duration <= 0) return null
  const [x, y] = TOWARDS_ANCHOR[side]
  return el.animate([{ translate: `${x * distance}px ${y * distance}px` }, { translate: '0 0' }], {
    duration,
    easing: computed.getPropertyValue('--prism-popup-in-easing').trim() || 'ease-out',
  })
}

// A floating glass panel over everything else on the page: a native popover,
// so the browser shows it in the top layer, out of reach of any z-index (see
// Popup.styles.ts for how it looks). It is controlled: `open` shows it, and
// `onClose` says it should close, on Escape or a press outside it and its
// anchor element, so pressing the element that toggles it doesn't close it
// only for the press to open it again. A popup rendered inside another counts
// as inside it.
//
// It opens beside an anchor element or at a point (placePopup.ts): a point
// suits a context menu, opened at the pointer on contextmenu. It is placed when
// it opens, after every render while open, as it resizes, and as the page
// scrolls or the window resizes, so it follows its anchor. Its left and top
// are set on the element directly.
//
// It slides in from its anchor as it fades in, and back towards it as it fades
// out, from whichever side it ends up on.
//
// It doesn't take focus on opening; what it holds can. If Escape closes it with
// focus inside, focus goes back to where it was when it opened. Content stays
// mounted while it is closed.
//
// Its glass shows a GlassBackdrop's image and nothing of the page between it
// and the popup (usePopupGlass.tsx), in the page's text colour and tint, as a
// card's does (../card/Card.tsx).
export function Popup({
  open,
  onClose,
  anchor,
  side = 'bottom',
  align = 'start',
  offset,
  alignOffset,
  padding = 'sm',
  highlight = true,
  refract = true,
  readableText = true,
  className,
  style,
  children,
  ref,
  ...rest
}: PopupProps) {
  const innerRef = useForwardedRef(ref)

  // Following only while open, but kept as it was while it fades out, so it goes with the popup.
  const edge = useEdgeLight(innerRef, highlight, open)
  const glass = usePopupGlass(innerRef, refract, open)
  // The button's rim, still: a popup is never pressed.
  const rim = useRim()
  const textColor = useGlassText(innerRef, { property: '--prism-card-fg' }, readableText, open)
  // Only to re-render, and so re-place, as it resizes.
  useElementSize(innerRef, open)

  const anchorElement = useEffectEvent(() => ('current' in anchor ? anchor.current : null))
  const close = useEffectEvent(() => onClose?.())

  const place = useEffectEvent(() => {
    const el = innerRef.current
    const rect =
      'current' in anchor
        ? anchor.current && unscaledRect(anchor.current.getBoundingClientRect(), getComputedStyle(anchor.current))
        : { left: anchor.x, top: anchor.y, width: 0, height: 0 }
    if (!el || !rect) return
    const root = document.documentElement
    const {
      x,
      y,
      side: placed,
    } = placePopup(
      rect,
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: root.clientWidth, height: root.clientHeight },
      { side, align, offset: offset ?? ('current' in anchor ? 8 : 0), alignOffset, margin: MARGIN },
    )
    // On whole device pixels: at a fractional offset the browser draws its
    // composited layer and the blur behind it out of step, which roughens the
    // curve of the corners.
    const snap = (v: number) => Math.round(v * devicePixelRatio) / devicePixelRatio
    el.style.left = `${snap(x)}px`
    el.style.top = `${snap(y)}px`
    // Which way it slides back to its anchor as it closes.
    if (el.dataset.side !== placed) el.dataset.side = placed
    return placed
  })

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!open || !el) return

    const returnFocus = document.activeElement
    el.showPopover()
    const placed = place()
    const slide = placed ? slideIn(el, placed) : null
    // Before any popup inside it that is already open: React opens the inner of
    // two popups that open together first.
    const inner = stack.findIndex((other) => el.contains(other))
    stack.splice(inner < 0 ? stack.length : inner, 0, el)

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!el.contains(target) && !anchorElement()?.contains(target)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || stack.at(-1) !== el) return
      if (el.contains(document.activeElement) && returnFocus instanceof HTMLElement) returnFocus.focus()
      close()
    }
    const onMove = () => place()

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    // Capturing, so a scroll inside any scroller moves it too.
    document.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      const at = stack.indexOf(el)
      if (at >= 0) stack.splice(at, 1)
      // Closed part way in, it slides back from where it is in the stylesheet's own time.
      slide?.cancel()
      // Hiding a popup that is already hidden, or gone, does nothing.
      el.hidePopover()
    }
  }, [open, innerRef])

  // Follows the anchor, its options and the content as they change.
  useLayoutEffect(() => {
    if (open) place()
  })

  const classes = cx('prism-popup', `prism-popup--pad-${padding}`, edge.className, className)

  return (
    <>
      <PrismStyles href="prism-corners" css={cornerStyles} />
      <PrismStyles href="prism-motion" css={motionStyles} />
      {/* For the card's tint, whose tokens the popup shares */}
      <PrismStyles href="prism-card" css={cardStyles} />
      <PrismStyles href="prism-popup" css={popupStyles} />
      <div
        ref={innerRef}
        popover="manual"
        className={classes}
        style={{
          ...(textColor && cssVars({ '--_prism-popup-fg': textColor })),
          ...style,
        }}
        {...rest}
      >
        {/* In the top layer, over the page a GlassBackdrop draws under, so glass inside is just its tint */}
        <BackdropContext value={null}>{children}</BackdropContext>
        {rim.element}
        {/* After the rim, so its light falls on it */}
        {edge.element}
        {/* Last, so it never becomes the content's :first-child */}
        {glass}
      </div>
    </>
  )
}
