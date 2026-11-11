// What readableForeground and readableSelection both judge colours by: the
// ratios WCAG 2.2 asks of text, the opaque colours a translucent background can
// come to, and the walk through a colour's shades to the nearest that passes.
import { mix, over, toHex, toRgba, type Rgb, type Rgba } from './color'

export type ContrastLevel = 'AA' | 'AAA'

export const BLACK: Rgb = { r: 0, g: 0, b: 0 }
export const WHITE: Rgb = { r: 255, g: 255, b: 255 }
export const DEFAULT_CANDIDATES = ['#000000', '#ffffff']
export const DEFAULT_BACKDROP = ['#ffffff', '#000000']
// How finely a preferred colour is darkened or lightened: 1% of the way at a time.
const SHADE_STEPS = 100

/** The minimum contrast ratio WCAG 2.2 asks of text at a level. */
export function minContrast(level: ContrastLevel = 'AA', large = false) {
  if (level === 'AAA') return large ? 4.5 : 7
  return large ? 3 : 4.5
}

/**
 * Whether text counts as large for WCAG: at least 18pt (24px), or 14pt
 * (18.66px) and bold. `fontWeight` is numeric, as getComputedStyle gives it.
 */
export function isLargeText(fontSizePx: number, fontWeight: number | string = 400) {
  return fontSizePx >= 24 || (Number(fontWeight) >= 700 && fontSizePx >= 18.66)
}

/** Every opaque colour the backgrounds can come to, each translucent one laid over each backdrop (taken as opaque). */
export function opaqueBackgrounds(backgrounds: readonly Rgba[], backdrop: readonly string[]): Rgb[] {
  const beneath = backdrop.map((css) => ({ ...toRgba(css), alpha: 1 }))
  return backgrounds.flatMap((bg) => (bg.alpha >= 1 ? [bg] : beneath.map((under) => over(bg, under))))
}

/**
 * The shade of `color` nearest it that meets `target`, darkening or lightening
 * it, whichever needs the smaller change; null if neither black nor white
 * would meet it. Each direction is walked in small steps rather than searched,
 * since against several backgrounds the worst ratio needn't rise steadily.
 */
export function shadeToPass(color: Rgb, worstRatio: (fg: Rgb) => number, target: number): Rgb | null {
  for (let step = 0; step <= SHADE_STEPS; step++) {
    const amount = step / SHADE_STEPS
    const passing = [mix(color, BLACK, amount), mix(color, WHITE, amount)]
      .map((shade) => toRgba(toHex(shade)))
      .map((shade) => ({ shade, ratio: worstRatio(shade) }))
      .filter(({ ratio }) => ratio >= target)
      .sort((a, b) => b.ratio - a.ratio)
    if (passing.length) return passing[0].shade
  }
  return null
}
