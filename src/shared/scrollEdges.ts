// Scroll geometry shared by the scroll fade (src/components/scroll) and the
// WebGPU backdrop (src/components/backdrop), so a scroller's content and the
// glass drawn behind it fade out at the same edges by the same amount. Pure:
// reads the element, never writes it.
import { clamp } from './clamp'
import { readCssNumber } from './readCssNumber'

/** A length per edge, in px. */
export interface Edges {
  top: number
  right: number
  bottom: number
  left: number
}

export type Side = keyof Edges

export const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left']

export const NO_EDGES: Edges = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 })

/** What a scroller shows of its content, as the DOM reports it. */
export interface ScrollMetrics {
  scrollTop: number
  /** Negative, from 0 at the right, in a right-to-left scroller. */
  scrollLeft: number
  scrollWidth: number
  scrollHeight: number
  clientWidth: number
  clientHeight: number
  rtl: boolean
}

function scrollMetrics(el: HTMLElement, computed: CSSStyleDeclaration): ScrollMetrics {
  return {
    scrollTop: el.scrollTop,
    scrollLeft: el.scrollLeft,
    scrollWidth: el.scrollWidth,
    scrollHeight: el.scrollHeight,
    clientWidth: el.clientWidth,
    clientHeight: el.clientHeight,
    rtl: computed.direction === 'rtl',
  }
}

/** How much content is scrolled out of view beyond each edge. */
export function hiddenBeyond(m: ScrollMetrics): Edges {
  const maxX = Math.max(m.scrollWidth - m.clientWidth, 0)
  const maxY = Math.max(m.scrollHeight - m.clientHeight, 0)
  // From the inline start, whichever side that is.
  const x = Math.min(Math.abs(m.scrollLeft), maxX)
  const y = clamp(m.scrollTop, 0, maxY)
  return {
    top: y,
    bottom: maxY - y,
    left: m.rtl ? maxX - x : x,
    right: m.rtl ? x : maxX - x,
  }
}

/**
 * How far in from each edge the content fades: `size` where there is more than
 * that to scroll to, ramping in over the first `size` px scrolled so the fade
 * never jumps on, and none where under a px is left (a fractional scroll
 * position that can't quite reach the end).
 */
export function fadeLengths(hidden: Edges, size: number): Edges {
  const fade = (px: number) => (px < 1 ? 0 : Math.min(px, size))
  return { top: fade(hidden.top), right: fade(hidden.right), bottom: fade(hidden.bottom), left: fade(hidden.left) }
}

/** Whether the user can scroll along an axis with this overflow; hidden content is clipped, not scrolled to. */
function scrolls(overflow: string) {
  return overflow === 'auto' || overflow === 'scroll'
}

/**
 * How far each edge of `el` fades: none unless it has a --prism-scroll-fade,
 * which .prism-scroll-fade sets (and nothing inherits), and only along an axis
 * it scrolls, so content clipped on the other (a y scroller's too-wide line)
 * doesn't fade at edges it can't be scrolled past.
 */
export function scrollFade(el: HTMLElement, computed: CSSStyleDeclaration): Edges {
  const size = readCssNumber(computed, '--prism-scroll-fade', 0)
  if (size <= 0) return NO_EDGES
  const fade = fadeLengths(hiddenBeyond(scrollMetrics(el, computed)), size)
  const x = scrolls(computed.overflowX)
  const y = scrolls(computed.overflowY)
  return {
    top: y ? fade.top : 0,
    bottom: y ? fade.bottom : 0,
    left: x ? fade.left : 0,
    right: x ? fade.right : 0,
  }
}

/**
 * How much shows `t` of the way in from a cut-off edge, 0 at the edge to 1 where
 * the fade ends: a smoothstep, which sets off and arrives with no slope. A
 * straight ramp has a corner at each end, and across the width of a card the
 * eye picks each out as a line, so the fade reads as an abrupt band.
 */
export function fadeEase(t: number) {
  return t * t * (3 - 2 * t)
}

/**
 * fadeEase in WGSL, of the expression `t` (an f32 or a vector of them), for
 * the glass, which a shader fades (src/components/backdrop/gpu/shaders.ts).
 */
export function fadeEaseWgsl(t: string) {
  return `(${t} * ${t} * (3.0 - 2.0 * ${t}))`
}

export function sameEdges(a: Edges, b: Edges) {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left
}
