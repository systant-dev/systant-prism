// Lens geometry for the WebGPU backdrop (src/components/backdrop), read from an
// element's CSS.
import { easeInOut } from './easing'
import { readCssNumber } from './readCssNumber'
import { readCssTime } from './readCssTime'
import { steadyClock } from './steadyClock'

/** A length in px that is 0 where it is unset, and can't be less. */
function readLength(computed: CSSStyleDeclaration, property: string) {
  return Math.max(readCssNumber(computed, property, 0), 0)
}

/** Red bends least and blue most, as in real glass. */
export const DISPERSION = { R: 0.8, G: 0.9, B: 1 } as const

/**
 * How far in from the edge the bend reaches: --prism-refraction-width, or when
 * that is `auto` (the default) the corner radius but at least 8px. Either way at
 * most a quarter of the shorter side, or with a `hole` through the lens, half the
 * width of the ring it leaves.
 */
export function bezelWidth(computed: CSSStyleDeclaration, radius: number, width: number, height: number, hole = 0) {
  const bezel = readCssNumber(computed, '--prism-refraction-width', Math.max(radius, 8))
  return Math.min(Math.max(bezel, 0), Math.max(Math.min(width, height) / 4 - hole / 2, 0))
}

/** The radius of a round hole through the middle of the lens, in px: --prism-refraction-hole, 0 for none. */
export function holeRadius(computed: CSSStyleDeclaration) {
  return readLength(computed, '--prism-refraction-hole')
}

/** A computed radius length in px: a percentage is of `basis`, anything unreadable is 0. */
function radiusPx(value: string, basis: number) {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return 0
  return value.endsWith('%') ? (n * basis) / 100 : n
}

/**
 * The top-left corner's radius in px. A computed radius keeps percentages (of the
 * border box) and may be elliptical (`16px 8px`); the lens has one radius per
 * corner, so an ellipse takes its shorter axis.
 */
export function cornerRadius(computed: CSSStyleDeclaration, width: number, height: number) {
  const [h, v = h] = computed.getPropertyValue('border-top-left-radius').trim().split(/\s+/)
  return Math.min(radiusPx(h, width), radiusPx(v, height))
}

/** The corners are CSS squircles. Computed values spell `squircle` out as superellipse(2). */
export function isSquircle(computed: CSSStyleDeclaration) {
  return /^(squircle|superellipse\(2\))$/.test(computed.getPropertyValue('corner-top-left-shape'))
}

/** How far the lens's edges fade across, in px: --prism-refraction-soft, 0 for as sharp as a pixel allows. */
export function softEdge(computed: CSSStyleDeclaration) {
  return readLength(computed, '--prism-refraction-soft')
}

/**
 * The blur glass rises to at its top as its bend fades out on the way there, in px:
 * --prism-refraction-frost, 0 for glass that is the same all the way up.
 */
export function frostBlur(computed: CSSStyleDeclaration) {
  return readLength(computed, '--prism-refraction-frost')
}

/** Displacement at the edge in px: --prism-refraction, as a percentage of the shorter side. */
export function refractionStrength(computed: CSSStyleDeclaration, width: number, height: number) {
  return (Math.min(width, height) * readCssNumber(computed, '--prism-refraction', 0)) / 100
}

// How long each element's glass has been fading in, so glass that stops being
// drawn for a while (a lost context, say) carries on rather than starting over.
const fadeClocks = new WeakMap<Element, (now: number) => number>()

/**
 * Starts the element's bend fading in afresh, as when its glass first showed:
 * for glass whose bend was dropped for a while and comes back.
 */
export function fadeBendIn(el: Element) {
  fadeClocks.delete(el)
}

/**
 * How much of the element's bend shows, 0–1: it fades in over
 * --prism-refraction-fade from when the element's glass first showed, so it
 * doesn't snap on a frame or two after the blur. It eases in and out, as a
 * GlassBackdrop's crossfade does: easing out alone puts a third of the bend on
 * screen in the first 50ms, which still reads as a snap. The first call starts
 * the clock; call it only once the glass is on screen, and once a frame while
 * it fades.
 *
 * Its clock is a steadyClock, moving on by at most LONGEST_FADE_STEP between calls. As a page loads,
 * the first frames with glass on them can take hundreds of ms (filters
 * rasterised, shaders compiled, images decoded, a web font swapped in), and a
 * fade timed by the wall clock would be over before it was seen; a stall holds
 * it where it was instead.
 */
export function bendShown(el: Element, computed: CSSStyleDeclaration, now = performance.now()) {
  let clock = fadeClocks.get(el)
  if (!clock) fadeClocks.set(el, (clock = steadyClock()))
  const elapsed = clock(now)
  const duration = readCssTime(computed.getPropertyValue('--prism-refraction-fade'))
  if (duration <= 0) return 1
  return easeInOut(Math.min(1, elapsed / duration))
}
