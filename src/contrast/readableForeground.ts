// Chooses a text colour for a background by WCAG 2.2's contrast criteria
// (1.4.3 Contrast (Minimum) at AA, 1.4.6 Contrast (Enhanced) at AAA), the
// standard the UK's accessibility regulations and EN 301 549 point to.
//
// Glass is translucent, so its colour alone says little about what text sits
// on: a 30% tint over a dark photo is dark, over a pale one pale. A translucent
// background is therefore laid over every colour in `backdrop`, and each
// candidate is judged by its worst contrast across all of them, so the colour
// chosen holds up wherever the glass goes. With no backdrop given, it must hold
// up over both white and black, which is strict but never wrong.
//
// Of the candidates, the one with the most contrast wins, not merely the first
// to pass: the minimum is a floor, and more contrast reads more easily. A
// `prefer`red colour (a brand colour, say) is kept when it passes, and
// otherwise darkened or lightened only as far as it must be, which keeps its
// hue; only if neither black nor white would do does it give way to the
// candidates.
// oxlint-disable-next-line no-restricted-imports -- straight from the module, not the index, which takes in hooks: a server imports this (src/server.ts)
import { clamp } from '../shared/clamp'
import { contrastRatio, over, toHex, toRgba, type Rgb } from './color'
import {
  DEFAULT_BACKDROP,
  DEFAULT_CANDIDATES,
  minContrast,
  opaqueBackgrounds,
  shadeToPass,
  type ContrastLevel,
} from './readability'

export interface ReadableOptions {
  /** The WCAG level to meet. Default 'AA'. */
  level?: ContrastLevel
  /** Large text (at least 24px, or 18.66px bold; see isLargeText), which needs less contrast. Default false. */
  large?: boolean
  /** A contrast ratio to meet instead of the level's, to leave a margin over busy images, say. */
  minRatio?: number
  /** The colours to choose from. Default black and white. */
  candidates?: readonly string[]
  /** A colour to use if it, or a darker or lighter shade of it, passes. */
  prefer?: string
  /** What a translucent background may lie over. Default white and black, the extremes. */
  backdrop?: readonly string[]
  /** How opaque the text is drawn, 0–1: a dimmed label is judged as it shows, laid over the background. Default 1. */
  opacity?: number
}

export interface Readable {
  /** The colour to use, as `#rrggbb`. */
  color: string
  /** Its contrast ratio against the background, at worst. */
  ratio: number
  /** The ratio it had to meet. */
  target: number
  /** Whether it meets it. When no candidate does, `color` is still the best of them. */
  passes: boolean
}

/** The text colour that reads best on `background`: one colour, or several it may be (a gradient's stops, say). */
export function readableForeground(background: string | readonly string[], options: ReadableOptions = {}): Readable {
  const {
    level = 'AA',
    large = false,
    minRatio,
    candidates = DEFAULT_CANDIDATES,
    prefer,
    backdrop = DEFAULT_BACKDROP,
    opacity = 1,
  } = options
  const target = minRatio ?? minContrast(level, large)
  const backgrounds = opaqueBackgrounds(
    (typeof background === 'string' ? [background] : background).map(toRgba),
    backdrop,
  )
  if (!backgrounds.length) throw new Error('readableForeground needs at least one background colour')

  const alpha = clamp(opacity, 0, 1)
  const shown = (fg: Rgb, bg: Rgb) => (alpha < 1 ? over({ ...fg, alpha }, { ...bg, alpha: 1 }) : fg)
  const worstRatio = (fg: Rgb) => Math.min(...backgrounds.map((bg) => contrastRatio(shown(fg, bg), bg)))
  // Judged as written out, so rounding to #rrggbb can't tip a colour just under the target.
  const result = (fg: Rgb): Readable => {
    const color = toHex(fg)
    const ratio = worstRatio(toRgba(color))
    return { color, ratio, target, passes: ratio >= target }
  }

  if (prefer) {
    const preferred = toRgba(prefer)
    const shade = shadeToPass(preferred, worstRatio, target)
    if (shade) return result(shade)
  }

  let best: Readable | null = null
  for (const candidate of candidates) {
    const option = result(toRgba(candidate))
    if (!best || option.ratio > best.ratio) best = option
  }
  if (!best) throw new Error('readableForeground needs at least one candidate colour')
  return best
}
