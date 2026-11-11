import type { RefObject } from 'react'
import { backgroundBehind } from './backgroundBehind'
import { toCss } from './color'
import { readableForeground, type Readable, type ReadableOptions } from './readableForeground'
import { useThemedValue } from './useThemedValue'

/**
 * The text colour that reads best on the element behind `ref`, from what is
 * actually painted behind it (see backgroundBehind), or null until it is read.
 * Where that is translucent over something unknown, such as a photo or a
 * GlassBackdrop, it is judged over each of `options.backdrop`: pass the
 * lightest and darkest colours the image runs to, or leave the default of
 * white and black for a colour that holds up over anything.
 *
 * It reads again when the options change, when the colour scheme changes, and
 * when a class, style or data-theme attribute changes on the element or an
 * ancestor, which is how themes are usually switched.
 */
export function useReadableForeground(
  ref: RefObject<Element | null>,
  options: ReadableOptions = {},
  enabled = true,
): Readable | null {
  const { level, large, minRatio, prefer, opacity } = options
  // Joined, so a fresh array of the same colours each render doesn't re-read.
  const candidates = options.candidates?.join('|')
  const backdrop = options.backdrop?.join('|')

  return useThemedValue(
    ref,
    (el): Readable =>
      readableForeground(toCss(backgroundBehind(el)), {
        level,
        large,
        minRatio,
        prefer,
        opacity,
        candidates: candidates?.split('|'),
        backdrop: backdrop?.split('|'),
      }),
    [level, large, minRatio, prefer, opacity, candidates, backdrop],
    { enabled, same: (a, b) => a.color === b.color && a.ratio === b.ratio && a.target === b.target },
  )
}
