// Chooses a highlight for selected text, and the colour of the text on it.
//
// A highlight has two jobs, so it is held to two ratios. The text on it must
// read, as any text must: WCAG 2.2's 1.4.3, by the same level and size as
// readableForeground. And it must show, or nothing looks selected: it marks a
// state, so 1.4.11 Non-text Contrast asks 3:1 of it against the background
// around it. That background is what readableForeground judges too: a translucent
// one is laid over every colour in `backdrop`, and the highlight is judged by its
// worst ratio across them. The highlight itself is opaque, so what the text sits
// on is known wherever the glass goes.
//
// Dark text wants a pale highlight and a pale field wants a dark one, so the two
// pull against each other and only a band of shades between them will do. The
// `prefer`red colour (an accent, say) is darkened or lightened only as far as it
// must be to land in that band. The highlight is the point, so the text gives way
// to it: of the `text` colour and the candidates, the one that leaves the
// highlight nearest the preferred colour wins, and `text` on a tie. Lightening a
// colour washes it out, so keeping dark text at any price would lose what the
// colour was chosen for. When nothing clears both ratios (a background running
// through every mid tone leaves no band at all) it returns what comes closest,
// so check `passes`.
import { contrastRatio, mix, toHex, toRgba, type Rgb } from './color'
import {
  BLACK,
  DEFAULT_BACKDROP,
  DEFAULT_CANDIDATES,
  WHITE,
  minContrast,
  opaqueBackgrounds,
  shadeToPass,
  type ContrastLevel,
} from './readability'

export interface SelectionOptions {
  /** The WCAG level the text on the highlight must meet. Default 'AA'. */
  level?: ContrastLevel
  /** Large text, which needs less contrast (see isLargeText). Default false. */
  large?: boolean
  /** A contrast ratio for the text to meet instead of the level's. */
  minRatio?: number
  /** The ratio the highlight must have against the background. Default 3, from WCAG 1.4.11. */
  minSeparation?: number
  /** The colour to keep the highlight near. Default '#6d7cff'. */
  prefer?: string
  /** The selected text's colour, kept unless a candidate leaves the highlight nearer `prefer`. */
  text?: string
  /** The other text colours to try. Default black and white. */
  candidates?: readonly string[]
  /** What a translucent background may lie over. Default white and black, the extremes. */
  backdrop?: readonly string[]
}

export interface ReadableSelection {
  /** The highlight, as `#rrggbb`. */
  background: string
  /** The text on it, as `#rrggbb`. */
  color: string
  /** The text's contrast ratio against the highlight. */
  ratio: number
  /** The ratio it had to meet. */
  target: number
  /** The highlight's contrast ratio against the background, at worst. */
  separation: number
  /** The ratio it had to meet. */
  separationTarget: number
  /** Whether both are met. When they can't be, the result is the closest found. */
  passes: boolean
}

const DEFAULT_ACCENT = '#6d7cff'
// How finely the closest shade is looked for when none passes.
const FALLBACK_STEPS = 20

function distance(a: Rgb, b: Rgb) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)
}

/** The highlight and text colour for a selection on `background`: one colour, or several it may be. */
export function readableSelection(
  background: string | readonly string[],
  options: SelectionOptions = {},
): ReadableSelection {
  const {
    level = 'AA',
    large = false,
    minRatio,
    minSeparation = 3,
    prefer = DEFAULT_ACCENT,
    text,
    candidates = DEFAULT_CANDIDATES,
    backdrop = DEFAULT_BACKDROP,
  } = options
  const target = minRatio ?? minContrast(level, large)
  const backgrounds = opaqueBackgrounds(
    (typeof background === 'string' ? [background] : background).map(toRgba),
    backdrop,
  )
  if (!backgrounds.length) throw new Error('readableSelection needs at least one background colour')

  const accent = toRgba(prefer)
  const inks = candidates.map(toRgba)
  if (!inks.length && !text) throw new Error('readableSelection needs a text colour or a candidate')

  const separation = (highlight: Rgb) => Math.min(...backgrounds.map((bg) => contrastRatio(highlight, bg)))
  // The nearer of the two ratios to its target, as a share of it: 1 or more clears both.
  const score = (ink: Rgb, highlight: Rgb) =>
    Math.min(contrastRatio(ink, highlight) / target, separation(highlight) / minSeparation)
  const nearestShade = (ink: Rgb) => shadeToPass(accent, (highlight) => score(ink, highlight), 1)

  const result = (ink: Rgb, highlight: Rgb): ReadableSelection => {
    const color = toHex(ink)
    const shown = toHex(highlight)
    // Judged as written out, so rounding to #rrggbb can't tip a colour just under the target.
    const ratio = contrastRatio(toRgba(color), toRgba(shown))
    const apart = separation(toRgba(shown))
    return {
      background: shown,
      color,
      ratio,
      target,
      separation: apart,
      separationTarget: minSeparation,
      passes: ratio >= target && apart >= minSeparation,
    }
  }

  const tried = text ? [toRgba(text), ...inks] : inks
  // A stable sort, so `text` wins a tie.
  const passing = tried
    .flatMap((ink) => {
      const shade = nearestShade(ink)
      return shade ? [{ ink, shade }] : []
    })
    .sort((a, b) => distance(a.shade, accent) - distance(b.shade, accent))
  if (passing.length) return result(passing[0].ink, passing[0].shade)

  let closest: { ink: Rgb; shade: Rgb; score: number } = { ink: tried[0], shade: accent, score: -1 }
  for (const ink of tried) {
    for (let step = 0; step <= FALLBACK_STEPS; step++) {
      for (const end of [BLACK, WHITE]) {
        const shade = mix(accent, end, step / FALLBACK_STEPS)
        const reached = score(ink, shade)
        if (reached > closest.score) closest = { ink, shade, score: reached }
      }
    }
  }
  return result(closest.ink, closest.shade)
}
