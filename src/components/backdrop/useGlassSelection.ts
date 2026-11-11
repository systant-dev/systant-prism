import { useContext, type RefObject } from 'react'
import {
  backgroundBehind,
  parseColor,
  readableSelection,
  toCss,
  useThemedValue,
  type ReadableSelection,
} from '../../contrast'
import { BackdropPaletteContext } from './BackdropContext'

export interface GlassSelection {
  /** The custom property holding the selected text's own colour. */
  textProperty: string
  /** The custom property holding the colour to keep the highlight near where the page gives none. */
  accentProperty: string
}

/**
 * The highlight and text colour for a selection in `el`.
 *
 * On glass over a GlassBackdrop's image that is `page`, the one selection of the
 * whole page (see readablePage), whatever part of the image `el` lies over. On
 * anything else (see readableSelection) it is a shade of its own accent, as near
 * it as both contrast ratios allow, and its own text colour if that will do. Null
 * there if the accent or the text isn't a colour this can read.
 *
 * Without `page`, translucent glass is judged over white and black, unlike glass
 * text, which is left alone there: the highlight has no colour of its own to fall
 * back on that is known to show.
 */
export function glassSelection(
  el: HTMLElement,
  { textProperty, accentProperty }: GlassSelection,
  page: ReadableSelection | null,
): ReadableSelection | null {
  // The backdrop's canvas is drawn over its own background, so the walk stops there.
  const background = backgroundBehind(el, el.closest('.prism-backdrop'))
  if (page && background.alpha < 1) return page
  const computed = getComputedStyle(el)
  const text = computed.getPropertyValue(textProperty).trim()
  const prefer = computed.getPropertyValue(accentProperty).trim()
  if (!parseColor(text) || !parseColor(prefer)) return null
  return readableSelection(toCss(background), { text, prefer })
}

/**
 * Keeps a selection in `ref`'s element visible and readable: the highlight and
 * text colour to give it, or null to leave the CSS be (see glassSelection). It
 * follows the page's colours, as the image changes, and theme changes (see
 * watchTheme).
 */
export function useGlassSelection(
  ref: RefObject<HTMLElement | null>,
  { textProperty, accentProperty }: GlassSelection,
  enabled = true,
): ReadableSelection | null {
  const page = useContext(BackdropPaletteContext)?.selection ?? null
  return useThemedValue(
    ref,
    (el) => glassSelection(el, { textProperty, accentProperty }, page),
    [page, textProperty, accentProperty],
    { enabled, same: (a, b) => a.background === b.background && a.color === b.color },
  )
}
