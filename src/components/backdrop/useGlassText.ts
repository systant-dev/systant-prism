import { useContext, type RefObject } from 'react'
import { backgroundBehind, parseColor, readableForeground, toCss, toHex, useThemedValue } from '../../contrast'
import { readCssNumber } from '../../shared'
import { BackdropPaletteContext } from './BackdropContext'

export interface GlassText {
  /**
   * The custom property holding the text's own colour (--prism-card-fg, say).
   * Where it is unset, the colour `el` inherits stands in for it.
   */
  property: string
  /** A custom property holding how opaque the text is drawn (a dimmed label's), 0–1. */
  opacityProperty?: string
}

/**
 * The colour for text on `el`, or null to leave the CSS colour be.
 *
 * On glass over a GlassBackdrop's image, or straight on it, that is `page`, the
 * one text colour of the whole page (see readablePage), whatever part of the
 * image `el` lies over. On anything opaque the page's colours say nothing, so
 * there it is its own colour (see GlassText) wherever that meets WCAG AA,
 * otherwise the shade of it nearest that does, or failing that black or white,
 * whichever reads better (see readableForeground). Null too where it reads
 * already, it isn't a colour this can read, or what shows through the glass is
 * unknown.
 */
export function glassTextColor(
  el: HTMLElement,
  { property, opacityProperty }: GlassText,
  page: string | null,
): string | null {
  // The backdrop's canvas is drawn over its own background, so the walk stops there.
  const background = backgroundBehind(el, el.closest('.prism-backdrop'))
  if (background.alpha < 1) return page
  const computed = getComputedStyle(el)
  const own =
    computed.getPropertyValue(property).trim() || (el.parentElement ? getComputedStyle(el.parentElement).color : '')
  const preferred = parseColor(own)
  if (!preferred) return null
  const { color } = readableForeground(toCss(background), {
    prefer: own,
    opacity: opacityProperty ? readCssNumber(computed, opacityProperty, 1) : 1,
  })
  return color === toHex(preferred) ? null : color
}

/**
 * Keeps text on `ref`'s element readable: the colour to give it in place of
 * its own, or null to leave that be (see glassTextColor). It follows the page's
 * colours, as the image changes, and theme changes (see watchTheme). While
 * `following` is false it stays the colour it was, for an element that doesn't
 * need to keep up but is still showing: a popup fading out.
 */
export function useGlassText(
  ref: RefObject<HTMLElement | null>,
  { property, opacityProperty }: GlassText,
  enabled = true,
  following = true,
): string | null {
  const page = useContext(BackdropPaletteContext)?.foreground ?? null
  return useThemedValue(
    ref,
    (el) => glassTextColor(el, { property, opacityProperty }, page),
    [page, property, opacityProperty],
    { enabled, following },
  )
}
