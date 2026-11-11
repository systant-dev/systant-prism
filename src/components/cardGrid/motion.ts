// How a CardGrid's cards get from one place to the next: each is laid out at
// once where it now belongs, then drawn back where it was with a translate and
// a scale, which transition away (see CardGrid.styles.ts), so it glides there
// without the layout moving again. A translate or scale transition on the card
// itself is one a GlassBackdrop follows, so its glass glides with it.
import type { Rect } from './layout'

/** Too small a difference in px, or in scale, to be worth moving. */
const STILL = 0.5
const STILL_SCALE = 0.005

/** Where `el` is laid out, relative to its offset parent (the grid), whatever its translate or scale. */
export function laidOut(el: HTMLElement): Rect {
  return { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight }
}

/**
 * Where the grid is drawn in the viewport, from which its cards are laid out
 * (its padding box, inside any border), and how much its ancestors scale it.
 */
export interface GridFrame {
  left: number
  top: number
  sx: number
  sy: number
}

/** `grid`'s frame as it is drawn now: a scale of its own is taken as its ancestors'. */
export function gridFrame(grid: HTMLElement): GridFrame {
  const box = grid.getBoundingClientRect()
  const sx = (grid.offsetWidth && box.width / grid.offsetWidth) || 1
  const sy = (grid.offsetHeight && box.height / grid.offsetHeight) || 1
  return { left: box.left + grid.clientLeft * sx, top: box.top + grid.clientTop * sy, sx, sy }
}

/** A point in the viewport, in the grid's own px, as cards are laid out in it. */
export function inGrid(frame: GridFrame, point: { x: number; y: number }) {
  return { x: (point.x - frame.left) / frame.sx, y: (point.y - frame.top) / frame.sy }
}

/**
 * Where `el` is drawn now, translate, scale and all, in the grid's own px, as
 * laidOut() measures: so a grid inside a scaled ancestor, or with a border,
 * glides its cards from where they really are.
 */
export function drawnAt(el: Element, frame: GridFrame): Rect {
  const r = el.getBoundingClientRect()
  const { x: left, y: top } = inGrid(frame, { x: r.left, y: r.top })
  return { left, top, width: r.width / frame.sx, height: r.height / frame.sy }
}

/** `rect` shrunk to `scale` of its size about its centre. */
export function shrunk(rect: Rect, scale: number): Rect {
  const width = rect.width * scale
  const height = rect.height * scale
  return { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height }
}

/** Stops `el` mid-move, where it is laid out: no transition, translate, scale or opacity of its own. */
export function halt(el: HTMLElement) {
  stopCounterScale(el)
  el.style.transition = 'none'
  el.style.translate = ''
  el.style.scale = ''
  el.style.opacity = ''
}

/** The translate and scale that draw a box laid out at `at` over `over`, and whether either is worth drawing. */
function between(at: Rect, over: Rect) {
  const x = over.left - at.left
  const y = over.top - at.top
  const sx = at.width ? over.width / at.width : 1
  const sy = at.height ? over.height / at.height : 1
  const moved = Math.abs(x) > STILL || Math.abs(y) > STILL
  const scaled = Math.abs(sx - 1) > STILL_SCALE || Math.abs(sy - 1) > STILL_SCALE
  return { x, y, sx, sy, moved, scaled }
}

/** Whether a box laid out at `at` is drawn far enough from `over` to be worth moving. */
export function apart(at: Rect, over: Rect) {
  const { moved, scaled } = between(at, over)
  return moved || scaled
}

/**
 * Draws `el`, laid out at `at`, over `over` instead, by translate and scale
 * about its top left. Whether it needed to.
 */
export function drawOver(el: HTMLElement, at: Rect, over: Rect): boolean {
  const { x, y, sx, sy, moved, scaled } = between(at, over)
  if (moved || scaled) el.style.translate = `${x}px ${y}px`
  if (scaled) el.style.scale = `${sx} ${sy}`
  return moved || scaled
}

// A card gliding between sizes is laid out at the new one, and drawn at the old
// by a scale, so its content would be drawn scaled too: blown up as a
// maximised card shrinks back, squashed as one expands. Its content (header and
// body, in one element) is scaled against it instead, by the inverse of the
// card's scale at every moment of the glide, so it keeps its own size, at the
// card's top left, as the card's box grows or shrinks around it. The card
// clips it meanwhile, so content laid out for a bigger box is uncovered as the
// box grows rather than spilling past it.

/** How many moments of the glide the content is scaled for, in between which it scales evenly. */
const COUNTER_STEPS = 32
/** Names the content's counter-scale among its animations, so a new move can stop it. */
const COUNTER_ID = 'prism-card-grid-counter-scale'

const KEYWORD_EASINGS: Record<string, string> = {
  ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  'ease-in': 'cubic-bezier(0.42, 0, 1, 1)',
  'ease-out': 'cubic-bezier(0, 0, 0.58, 1)',
  'ease-in-out': 'cubic-bezier(0.42, 0, 0.58, 1)',
}

/**
 * A CSS easing as a function from time to progress, both 0–1: a cubic-bezier()
 * or one of its keywords; anything else (linear, steps()) as linear.
 */
export function easingCurve(css: string): (t: number) => number {
  const value = css.trim()
  const points = /^cubic-bezier\(([^)]+)\)$/
    .exec(KEYWORD_EASINGS[value] ?? value)?.[1]
    .split(',')
    .map(Number)
  if (points?.length !== 4 || !points.every(Number.isFinite)) return (t) => t
  const [x1, y1, x2, y2] = points
  const along = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3
  return (t) => {
    // The curve's x rises from 0 to 1, so halving finds where it reaches t.
    let low = 0
    let high = 1
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2
      if (along(x1, x2, mid) < t) low = mid
      else high = mid
    }
    return along(y1, y2, (low + high) / 2)
  }
}

function contentOf(card: HTMLElement) {
  return card.querySelector<HTMLElement>(':scope > .prism-card-grid__content')
}

/**
 * Keeps the content of `card` its own size as the card glides from a scale of
 * `sx` × `sy` to none, over `duration` ms on `easing` (CSS), as its transition
 * does. The animation, or null where there is nothing to run, or no Web
 * Animations API.
 */
export function counterScale(card: HTMLElement, sx: number, sy: number, duration: number, easing: string) {
  const content = contentOf(card)
  const scaled = Math.abs(sx - 1) > STILL_SCALE || Math.abs(sy - 1) > STILL_SCALE
  const drawable = Number.isFinite(sx) && Number.isFinite(sy) && sx > 0 && sy > 0
  if (!content || typeof content.animate !== 'function' || !scaled || !drawable || duration <= 0) return null
  stopCounterScale(card)
  const ease = easingCurve(easing)
  const keyframes = Array.from({ length: COUNTER_STEPS + 1 }, (_, i) => {
    const progress = ease(i / COUNTER_STEPS)
    return { transform: `scale(${1 / (sx + (1 - sx) * progress)}, ${1 / (sy + (1 - sy) * progress)})` }
  })
  card.style.overflow = 'clip'
  const animation = content.animate(keyframes, { id: COUNTER_ID, duration, easing: 'linear' })
  const done = () => {
    if (
      !contentOf(card)
        ?.getAnimations()
        .some((a) => a.id === COUNTER_ID)
    )
      card.style.overflow = ''
  }
  animation.addEventListener('finish', done)
  animation.addEventListener('cancel', done)
  return animation
}

/** Stops any counter-scale on `card`'s content, as it is moved afresh. */
function stopCounterScale(card: HTMLElement) {
  const content = contentOf(card)
  if (!content || typeof content.getAnimations !== 'function') return
  for (const animation of content.getAnimations()) if (animation.id === COUNTER_ID) animation.cancel()
  card.style.overflow = ''
}

// A card's reflected streaks (.prism-card__streaks, src/components/card) are
// fixed to the viewport, so they line up from card to card, but a fixed
// background moves with its element while the element has a translate or a
// scale, and jumps back once it has none: at the end of every glide. In the
// grid they are lined up across the grid instead, each card's set back by
// where it is in the grid, and slid back by however far the card is drawn from
// its place, on the card's own timing, so they hold still as it glides and
// nothing changes when it stops.

// On the card's own glide duration (CardGrid.styles.ts), which a maximised card's is quicker than the rest.
const STREAKS_GLIDE = 'background-position var(--prism-card-grid-glide-duration) var(--prism-card-grid-easing)'

/**
 * The streaks are one image, not repeated, STREAKS_SIZE px square, with the
 * grid's top left STREAKS_ORIGIN px into it on each axis: so every card, and a
 * card dragged as far as STREAKS_ORIGIN px beyond the grid's top or left, lies
 * wholly inside it. Tiled at the card's own size, as a background is by
 * default, the 45° pattern would break off at the tiles' edges, and those lie
 * inside every card the grid lines up away from its first.
 */
export const STREAKS_SIZE = 20000
const STREAKS_ORIGIN = 5000

function streaksOf(card: HTMLElement) {
  return card.querySelector<HTMLElement>(':scope > .prism-card__streaks')
}

function streaksAt(rect: Rect) {
  return `${-(rect.left + STREAKS_ORIGIN)}px ${-(rect.top + STREAKS_ORIGIN)}px`
}

/** Lines the card's streaks up for it drawn at `rect`, relative to the grid, at once. Whether they moved. */
export function lineUpStreaks(card: HTMLElement, rect: Rect): boolean {
  const streaks = streaksOf(card)
  const position = streaksAt(rect)
  if (!streaks || streaks.style.backgroundPosition === position) return false
  streaks.style.transition = 'none'
  streaks.style.backgroundPosition = position
  return true
}

/** Slides the card's streaks to line up for it laid out at `rect`, as it glides there. */
export function glideStreaks(card: HTMLElement, rect: Rect) {
  const streaks = streaksOf(card)
  if (!streaks) return
  streaks.style.transition = STREAKS_GLIDE
  streaks.style.backgroundPosition = streaksAt(rect)
}

// When a drag ends the cards spring: the one let go along the way it glided
// home, overshooting its place and swinging back, smaller and slower each time
// until it settles, and every other card away from it, less and later the
// further it is, like a ripple spreading out. It is a Web Animation of `transform`, which the browser adds
// to the `translate` and `scale` a card glides by, so it never gets in a
// glide's way.

/** How many times it swings out and back, and how quickly the swings die away. */
const SPRING_WAVES = 2.5
const SPRING_DECAY = 2.5
/** How much of the dropped card's spring the cards beside it get, and over how many px that halves, roughly. */
const SPRING_NEIGHBOURS = 0.7
const SPRING_REACH = 450
/** Too small a spring, in px, to be worth running. */
const SPRING_STILL = 0.3
/** Names a card's spring among its animations, so a new drag can stop it. */
const SPRING_ID = 'prism-card-grid-spring'

/**
 * A damped spring's offset at `steps` + 1 evenly spaced moments, as a share of
 * its widest swing: out first, to 1, then back past where it began, each swing
 * smaller and slower than the last, settling at rest at the end.
 */
export function springOffsets(steps = 48): number[] {
  const wave = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    // Its time eases out, so each swing takes longer than the one before, as a
    // spring running down does.
    const phase = 1 - (1 - t) ** 2
    // It dies away, and eases into rest: by the end neither a swing nor any
    // speed is left, so it settles rather than stops.
    const size = Math.exp(-SPRING_DECAY * t) * (1 - t) ** 2
    return size * Math.sin(2 * Math.PI * SPRING_WAVES * phase)
  })
  const widest = Math.max(...wave.map(Math.abs))
  return wave.map((offset) => offset / widest)
}

/** How much of the dropped card's spring a card `distance` px from it gets: less the further it is. */
export function springFalloff(distance: number) {
  return SPRING_NEIGHBOURS * Math.exp(-distance / SPRING_REACH)
}

/**
 * Springs `el` by `amplitude` px towards `direction` (a unit vector) and back,
 * after `delay` ms, over `duration` ms. The animation, or null where there is
 * nothing to run, or no Web Animations API.
 */
export function spring(
  el: HTMLElement,
  direction: { x: number; y: number },
  amplitude: number,
  { delay, duration }: { delay: number; duration: number },
): Animation | null {
  if (typeof el.animate !== 'function' || amplitude < SPRING_STILL || duration <= 0) return null
  stopSpring(el)
  // To the hundredth of a px: finer is unseen, and keeps the tiniest out of exponent form
  const px = (n: number) => Math.round(n * 100) / 100 || 0
  const keyframes = springOffsets().map((offset) => ({
    transform: `translate(${px(direction.x * offset * amplitude)}px, ${px(direction.y * offset * amplitude)}px)`,
  }))
  return el.animate(keyframes, { id: SPRING_ID, delay, duration, easing: 'linear' })
}

/** Stops any spring `el` has running, as it is picked up again. */
export function stopSpring(el: HTMLElement) {
  if (typeof el.getAnimations !== 'function') return
  for (const animation of el.getAnimations()) if (animation.id === SPRING_ID) animation.cancel()
}

/** Lets `el` transition again, from however it was last drawn to however its classes say. */
export function release(el: HTMLElement) {
  el.style.transition = ''
  el.style.translate = ''
  el.style.scale = ''
  el.style.opacity = ''
}

// A card under the dragged one is shaded and blurred by how much of it is
// covered. Every change repaints the card and blurs its content afresh, so its
// blur is followed in whole px, which look no different on the move.

/** How finely a covered card's blur is followed, in px. */
const BLUR_STEP = 1

/** `value` to the nearest `step`, a whole fraction (1, 0.05). */
export function toStep(value: number, step: number) {
  // Over a whole number, so 0.3 comes out as 0.3 rather than 0.30000000000000004.
  return Math.round(value / step) / Math.round(1 / step)
}

/**
 * Shows `covered` of a card, 0–1, as under the dragged one: its tint darkened
 * by as much, the whole card blurred by as much of `blur` px (its edges and
 * shadow as well as its content), and its border light and sheen faded out
 * (data-prism-covered, which React leaves alone). At 0 it is as it was, with
 * no filter.
 */
export function showCovered(card: HTMLElement, covered: number, blur: number) {
  if (covered > 0) card.style.setProperty('--prism-card-grid-covered', String(covered))
  else card.style.removeProperty('--prism-card-grid-covered')
  card.toggleAttribute('data-prism-covered', covered > 0)
  const px = toStep(covered * blur, BLUR_STEP)
  card.style.filter = px > 0 ? `blur(${px}px)` : ''
}
