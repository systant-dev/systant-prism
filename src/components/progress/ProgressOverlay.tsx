import { useLayoutEffect, useRef, type ComponentProps } from 'react'
import { useGlassText } from '../backdrop'
import { usePopupGlass } from '../popup'
import { cx, motionStyles, PrismStyles, useForwardedRef } from '../../shared'
import { progressStyles } from './Progress.styles'
import { progressOverlayStyles } from './ProgressOverlay.styles'
import { Ring } from './Ring'

export interface ProgressOverlayProps extends Omit<ComponentProps<'dialog'>, 'children' | 'open'> {
  /** Whether it shows, over the whole page. It fades in and out as this changes, so leave it mounted. */
  open: boolean
  /** Bend what is behind the ring, as thick glass does. */
  refract?: boolean
  /** Take the page's text colour inside a GlassBackdrop, and stay readable (WCAG AA) on an opaque background. */
  readableFill?: boolean
}

// A Progress ring in the middle of the viewport, with everything under it dimmed:
// for when the page can't be used until something has finished.
// See ProgressOverlay.styles.ts for how it looks and fades.
//
// It is a modal <dialog>, so while it shows the rest of the page is out of reach
// of the pointer, the keyboard and assistive technology alike, and focus goes
// back where it was when it closes. It can't be dismissed: Escape does nothing,
// as only what it is waiting for can end it. Say what that is with `aria-label`.
//
// In the top layer it lies over the page a GlassBackdrop draws under, so its
// glass is a canvas of its own, as a popup's is (usePopupGlass), showing the image
// and nothing of the page between. It is drawn only while `open`, and its canvas
// fades out with it.
//
// Its fill follows the page's glass, dark or light, as a Progress's does. It stays
// the colour it was as it fades out, as a popup's text does.
export function ProgressOverlay({
  open,
  refract = true,
  readableFill = true,
  'aria-label': ariaLabel = 'Loading',
  className,
  onCancel,
  ref,
  ...rest
}: ProgressOverlayProps) {
  const innerRef = useForwardedRef(ref)
  const ringRef = useRef<HTMLDivElement>(null)
  const glass = usePopupGlass(ringRef, refract, open, 'prism-progress__glass')
  const fill = useGlassText(
    ringRef,
    { property: '--prism-progress-fill', opacityProperty: '--prism-progress-fill-opacity' },
    readableFill,
    open,
  )

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!open || !el) return
    el.showModal()
    return () => el.close()
  }, [open, innerRef])

  return (
    <>
      <PrismStyles href="prism-motion" css={motionStyles} />
      <PrismStyles href="prism-progress" css={progressStyles} />
      <PrismStyles href="prism-progress-overlay" css={progressOverlayStyles} />
      <dialog
        ref={innerRef}
        // Chrome lets a second Escape past onCancel, which this stops.
        closedby="none"
        aria-label={ariaLabel}
        className={cx('prism-progress-overlay', className)}
        onCancel={(event) => {
          onCancel?.(event)
          event.preventDefault()
        }}
        {...rest}
      >
        <Ring ref={ringRef} aria-label={ariaLabel} fill={fill}>
          {glass}
        </Ring>
      </dialog>
    </>
  )
}
