// Chooses the colours of a whole page laid over one image: one text colour, one
// tint for all its glass, and one highlight for selected text. Every control
// takes the same three, wherever on the image it lies, so no two controls on a
// page disagree.
//
// No one text colour can read on every tint over every part of a photo: a pale
// textbox wants dark text, smoky glass over the same image wants light. So the
// tint is chosen along with the text, as a pair.
//
// A pair is judged over the image from its dark end to its light: its range (the
// 2nd and 98th percentiles by luminance) and the three tones between. A card may
// lie anywhere, and an image that is sky above and sea below has a whole band at
// each end, which the middle half alone would never see. Few images let a thin
// tint read across all that, so what is asked of each pair is how thick the glass
// must be for its text to meet the level: the thinnest glass as it is, or with
// more tint. The pair that needs the less is the page's, the theme's where they
// need the same, and the glass is made that thick. A dark photo so turns a light
// theme's glass dark, and one that is light above and dark below keeps whichever
// pair the least tint will carry, and gets that tint.
//
// What is left over is how far text may be dimmed: an idle entry drawn at 85% is
// fainter than the text that was judged. `dimmest` is the lowest opacity that
// still meets the level on that glass, for a control to hold its dimming to.
//
// The darkest and lightest fiftieth of the image are left out, or the moon and its
// glitter would thicken the glass of the whole page. Text over those may fall short.
//
// The highlight is then held to readableSelection's two ratios, on that tint as
// thin as a field's and as thick as it can get (a field on a card), over the
// middle half of the image's tones. Its text is the page's, or the alternate's
// where the highlight needs it: dark text wants a pale highlight, and a pale
// field wants a dark one, so the two can't always be the same colour.
// oxlint-disable-next-line no-restricted-imports -- straight from the module, not the index, which takes in hooks: a server imports this (src/server.ts)
import { clamp } from '../shared/clamp'
import { toCss, toRgba } from './color'
import { readableForeground } from './readableForeground'
import { readableSelection, type ReadableSelection } from './readableSelection'
import type { ContrastLevel } from './readability'

export interface PageImage {
  /** The image's lower quartile, median and upper quartile by luminance. */
  tones: readonly [string, string, string]
  /**
   * The image's dark and light ends: its 2nd and 98th percentiles by luminance.
   * Left out, the quartiles stand for them, and only the middle half is judged.
   */
  range?: readonly [string, string]
  /** The colour the image is known by; null if it has too little colour for one. */
  dominant: string | null
}

/** A text colour and the tint it goes with. */
export interface GlassTheme {
  foreground: string
  background: string
}

export interface PageOptions {
  /** The pair to keep wherever its text reads. */
  theme: GlassTheme
  /** The pair to turn to where it doesn't, the theme's opposite. */
  alternate: GlassTheme
  /** The colour to keep the highlight near where the image has no dominant colour. */
  accent?: string
  /** The WCAG level the text must meet. Default 'AA'. */
  level?: ContrastLevel
  /** How thick the thinnest glass with text on it is before any is added, 0–1. Default 0.3, a card's. */
  glassOpacity?: number
  /** How thick a field's tint is, 0–1. Default 0.6, a textbox's. */
  fieldOpacity?: number
}

export interface ReadablePage {
  /** The text on every control, as given in the pair chosen. */
  foreground: string
  /** The tint of every control's glass, as given in the pair chosen. */
  background: string
  /**
   * How thick the thinnest glass with text on it must be for that text to read
   * over the image, 0–1: the `glassOpacity` given, or more.
   */
  glassOpacity: number
  /** The lowest opacity text can be dimmed to on that glass and still read, 0–1. */
  dimmest: number
  /** The highlight for selected text, and the text on it. */
  selection: ReadableSelection
}

function tinted(color: string, alpha: number) {
  return toCss({ ...toRgba(color), alpha })
}

/**
 * The least amount, of `from` and each hundredth above it up to 1, at which `reads`
 * holds, given that it holds from there on up; 1 if it holds at none.
 */
function least(from: number, reads: (amount: number) => boolean) {
  let low = Math.round(clamp(from, 0, 1) * 100)
  let high = 100
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (reads(middle / 100)) high = middle
    else low = middle + 1
  }
  return low / 100
}

/** The one text colour, tint and highlight for a page over `image`, and how thick its glass must be. */
export function readablePage(
  { tones, range, dominant }: PageImage,
  { theme, alternate, accent, level = 'AA', glassOpacity = 0.3, fieldOpacity = 0.6 }: PageOptions,
): ReadablePage {
  const backdrop = range ? [range[0], ...tones, range[1]] : tones
  const reads = ({ foreground, background }: GlassTheme, glass: number, opacity = 1) =>
    readableForeground(tinted(background, glass), { candidates: [foreground], backdrop, level, opacity }).passes
  const thinnest = (pair: GlassTheme) => least(glassOpacity, (glass) => reads(pair, glass))
  const kept = thinnest(theme)
  const turned = kept > glassOpacity ? thinnest(alternate) : kept
  const pair = kept <= turned ? theme : alternate
  const other = pair === theme ? alternate : theme
  const glass = Math.min(kept, turned)

  return {
    ...pair,
    glassOpacity: glass,
    dimmest: least(0, (opacity) => reads(pair, glass, opacity)),
    selection: readableSelection([tinted(pair.background, Math.max(fieldOpacity, glass)), pair.background], {
      level,
      prefer: dominant ?? accent,
      text: pair.foreground,
      candidates: [other.foreground],
      backdrop: tones,
    }),
  }
}
