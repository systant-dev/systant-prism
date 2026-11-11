// Playing a CardGrid's change of layout once React has laid it out: every card
// that has somewhere to go is drawn back where it was and let go to glide (see
// motion.ts), cards leaving fade out where they are pinned, a dropped card and
// those round it spring, and cards that were under the dragged one settle. It
// works on the cards' elements alone; what outlasts it (timers, focus, the
// backdrop following the motion) is the grid's.
import { fadeBendIn, readCssNumber, readCssTime } from '../../shared'
import { isShown, shownCards, type CardGridLayout, type Rect } from './layout'
import {
  apart,
  counterScale,
  drawOver,
  glideStreaks,
  halt,
  laidOut,
  lineUpStreaks,
  release,
  showCovered,
  shrunk,
  spring,
  springFalloff,
} from './motion'

/**
 * A change with timing of its own (CardGrid.styles.ts, by the grid's
 * data-prism-change): a maximised card put back, which shrinks first, the
 * others fading back in where they are once it has; or a card brought back from
 * its chip, which fades in where it belongs as the chip fades out.
 */
export type ChangeKind = 'unmaximise' | 'undock'

/** What the next layout should animate from: where every card was drawn just before it changed. */
export interface Change {
  cards: Map<string, Rect>
  /** Cards leaving the grid: for the tray, or to make way for one filling it. */
  leaving: string[]
  /** What to focus once laid out. */
  focus?: { id: string; on: 'chip' | 'title' }
  /** Cards that were under the dragged one when it was let go, and the most they were blurred, to settle. */
  uncover?: { ids: string[]; blur: number }
  /** The card just let go, whose streaks rode along with it, so slide back into line as it glides home. */
  dropped?: string
  kind?: ChangeKind
}

/** What a drop leaves for the next layout to settle. */
export type DropSettle = Pick<Change, 'uncover' | 'dropped'>

/** Allowed past a card's glide or fade before it is taken as over. */
export const GRACE_MS = 50

/** The size a card fades in from, new to the grid by any other change than the ones with timing of their own. */
const FADED_SCALE = 0.96

/**
 * How much later, in ms per px from the dropped card, a card's spring starts:
 * the ripple's speed. The dropped card springs the moment it is let go, as it
 * glides home, so there is no pause; the ripple reaches cards 600px away 60ms on.
 */
const RIPPLE_MS_PER_PX = 0.1

export interface ChangeScene {
  cards: ReadonlyMap<string, HTMLElement>
  /** What the grid now shows. */
  view: CardGridLayout
  /** The card being dragged, which follows the pointer rather than gliding. */
  dragged: string | undefined
  /** Whether a card leaving is pinned where it was, to fade out there. */
  pinned: (id: string) => boolean
}

export interface PlayedChange {
  /** How long the glides and fades take, in ms, grace and all; 0 where nothing glides or fades. */
  glideMs: number
  /** How long the springs from a drop take, in ms, to the last one's end; 0 for none. */
  springMs: number
  /** The cards now fading out of the grid, to let go of once `glideMs` has passed. */
  leaving: string[]
}

/**
 * Springs the cards the moment `dropped` is let go, where it was drawn at
 * `was`: it the most, along the way it glides home, and every other card
 * away from it, less and later the further it is. How long until the last
 * spring ends, in ms; 0 where none runs.
 */
function springFrom(grid: HTMLElement, dropped: HTMLElement, was: Rect | undefined, scene: ChangeScene) {
  const computed = getComputedStyle(grid)
  const amplitude = readCssNumber(computed, '--prism-card-grid-spring', 0)
  const duration = readCssTime(computed.getPropertyValue('--prism-card-grid-spring-duration'))
  if (amplitude <= 0 || duration <= 0) return 0
  const at = laidOut(dropped)
  const centre = { x: at.left + at.width / 2, y: at.top + at.height / 2 }
  const towards = (x: number, y: number, otherwise: { x: number; y: number }) => {
    const length = Math.hypot(x, y)
    return length > 0.5 ? { x: x / length, y: y / length } : otherwise
  }
  // Along its glide home; straight down, as if set down, where it had no way to go.
  const home = was ? towards(at.left - was.left, at.top - was.top, { x: 0, y: 1 }) : { x: 0, y: 1 }
  let longest = 0
  for (const id of shownCards(scene.view)) {
    const el = scene.cards.get(id)
    if (!el) continue
    const r = el === dropped ? at : laidOut(el)
    const dx = r.left + r.width / 2 - centre.x
    const dy = r.top + r.height / 2 - centre.y
    const distance = Math.hypot(dx, dy)
    const delay = distance * RIPPLE_MS_PER_PX
    const sprung =
      el === dropped
        ? spring(el, home, amplitude, { delay: 0, duration })
        : spring(el, towards(dx, dy, home), amplitude * springFalloff(distance), { delay, duration })
    if (sprung) longest = Math.max(longest, delay + duration)
  }
  return longest
}

/** Plays `from` on the grid's cards as `scene` now lays them out. */
export function playChange(grid: HTMLElement, from: Change, scene: ChangeScene): PlayedChange {
  const { cards, view, dragged, pinned } = scene
  // Its timing (CardGrid.styles.ts) set before anything is let go to transition, and kept until the next change.
  if (from.kind) grid.setAttribute('data-prism-change', from.kind)
  else grid.removeAttribute('data-prism-change')
  // Every shown card but the dragged one that has somewhere to go: from
  // where it was drawn, or, new to the grid, faded in, where it belongs or
  // from a little smaller. The rest are left as they are, so any transition
  // they have running (a cover fading) carries on rather than being cut short.
  const moving = view.order.flatMap((id) => {
    const el = cards.get(id)
    if (!el || id === dragged || !isShown(view, id)) return []
    const was = from.cards.get(id)
    const at = laidOut(el)
    // Faded out, or on its way, and back before it was hidden: it fades in again, even from where it is.
    const faded = el.style.opacity === '0'
    return !was || faded || apart(at, was) ? [{ id, el, at, was, faded }] : []
  })
  const outgoing = from.leaving.flatMap((id) => {
    const el = cards.get(id)
    return el && pinned(id) && !isShown(view, id) ? [{ id, el }] : []
  })

  for (const { el } of [...moving, ...outgoing]) halt(el)
  for (const { id, el, at, was, faded } of moving) {
    // Back from behind a maximised card, or from the tray, they only fade in, as they faded out.
    const start = was ?? (from.kind ? at : shrunk(at, FADED_SCALE))
    if (!was || faded) el.style.opacity = '0'
    drawOver(el, at, start)
    if (id !== from.dropped) lineUpStreaks(el, start)
  }
  // Drawn where they were; from here on they transition.
  void grid.offsetWidth
  for (const { el, at } of moving) {
    release(el)
    glideStreaks(el, at)
  }
  // Those changing size keep their content its own size as they glide:
  // each one's timing read before any is started, as starting one writes.
  const resized = moving.flatMap(({ el, at, was }) => {
    if (!was || (Math.abs(was.width - at.width) <= 0.5 && Math.abs(was.height - at.height) <= 0.5)) return []
    const card = getComputedStyle(el)
    const duration = readCssTime(card.getPropertyValue('--prism-card-grid-glide-duration'))
    const easing = card.getPropertyValue('--prism-card-grid-easing')
    return [{ el, sx: was.width / at.width, sy: was.height / at.height, duration, easing }]
  })
  for (const { el, sx, sy, duration, easing } of resized) counterScale(el, sx, sy, duration, easing)
  // Let go just where it belongs, it has nowhere to glide, but its streaks still do.
  const dropped = from.dropped === undefined ? undefined : cards.get(from.dropped)
  if (dropped && !moving.some(({ el }) => el === dropped)) {
    // Nothing else lets it go: it would keep the no transition it was dragged with.
    release(dropped)
    glideStreaks(dropped, laidOut(dropped))
  }

  // The longest anything takes: a glide, or a maximised card's, and the fade that follows it.
  const computed = getComputedStyle(grid)
  const time = (property: string) => readCssTime(computed.getPropertyValue(property))
  const staged = time('--prism-card-grid-maximise-duration') + time('--prism-card-grid-maximise-fade')
  const ms = Math.max(time('--prism-card-grid-duration'), staged) + GRACE_MS

  const springMs = dropped ? springFrom(grid, dropped, from.cards.get(from.dropped!), scene) : 0
  for (const { el } of outgoing) {
    if (el.hasAttribute('data-prism-fading')) {
      // Faded out already, to make way for one filling the grid: it stays
      // so, with no transition (halted) to fade it in and out again.
      el.removeAttribute('data-prism-fading')
    } else {
      // Docked: it fades out where it is, as its chip fades in (CardGrid.styles.ts).
      release(el)
    }
    el.style.opacity = '0'
  }

  // Their cover eases away, and their bend, dropped while covered, fades back in.
  for (const id of from.uncover?.ids ?? []) {
    const el = cards.get(id)
    if (!el) continue
    showCovered(el, 0, from.uncover!.blur)
    fadeBendIn(el)
  }

  return {
    glideMs: moving.length || outgoing.length ? ms : 0,
    springMs,
    leaving: outgoing.map(({ id }) => id),
  }
}
