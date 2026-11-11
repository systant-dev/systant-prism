import { useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { OverlayBackdropContext } from '../backdrop'

/**
 * Glass for a popup: the nearest GlassBackdrop's image behind it, blurred and
 * bent at the edges, on a canvas of its own, as the backdrop's canvas lies under
 * the page and the popup over it. Returns that canvas to render inside the
 * popup, or null outside a GlassBackdrop, where it is just its tint.
 *
 * It is drawn only while `open`. The canvas stays as it was while the popup
 * fades out, so the glass goes with it. `className` is for what its own styles
 * call it, for anything else in the top layer that wants glass.
 */
export function usePopupGlass(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  open: boolean,
  className = 'prism-popup__glass',
): ReactNode {
  const backdrop = useContext(OverlayBackdropContext)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = ref.current
    const canvas = canvasRef.current
    if (backdrop && enabled && open && el && canvas) return backdrop.trackOverlay(el, canvas)
  }, [backdrop, enabled, open, ref])

  // As useBackdropLens: CSS can change without a resize or scroll.
  useEffect(() => {
    if (enabled && open && backdrop) backdrop.invalidate()
  })

  if (!enabled || !backdrop) return null
  return (
    <span className={className} aria-hidden="true">
      <canvas ref={canvasRef} />
    </span>
  )
}
