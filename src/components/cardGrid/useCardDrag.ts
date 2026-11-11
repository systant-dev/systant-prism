import { useContext, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { BackdropContext } from '../backdrop'
import { clamp, fadeBendIn, readCssNumber, useHandler } from '../../shared'
import type { DropSettle } from './change'
import { cardAt, coverage, EMPTY_LAYOUT, moveCard, shownCards, type CardGridLayout, type Rect } from './layout'
import { drawnAt, gridFrame, halt, inGrid, laidOut, showCovered, stopSpring, toStep } from './motion'

/** How far in px the pointer must move with a header held down before its card is dragged. */
const DRAG_SLOP = 4
/**
 * How finely the cover of a card under the dragged one is followed. Every
 * change repaints the card and blurs its content afresh, so coarse steps,
 * which look no different on the move, spare most of them.
 */
const COVERED_STEP = 0.05

export interface Drag {
  id: string
  /** The order while dragging; committed when let go. */
  order: string[]
}

interface DragSession {
  id: string
  pointer: { x: number; y: number }
  /** Where the pointer holds the card, from its top left. */
  grab: { x: number; y: number }
  /** The card it last moved past, until the pointer leaves it, so two of different sizes don't swap back and forth. */
  passed: string | null
  /** The order as it has moved it, ahead of the render that shows it; committed when let go. */
  order: string[]
  /** The most a card under it is blurred, in px: --prism-card-grid-under-blur. */
  blur: number
  /** How much of each card under it is covered, in steps of COVERED_STEP. */
  covered: Map<string, number>
  /**
   * Where it and every other shown card are laid out, relative to the grid,
   * and the grid's size, which it is kept inside: read once and kept until the
   * next render, as only a render moves them.
   */
  laid: { at: Rect; others: [string, Rect][]; width: number; height: number } | null
  stop: () => void
}

export interface CardDragOptions {
  /** About to show a new order: note where every card is drawn, for it to glide from, and what a drop leaves to settle. */
  willChange: (settle?: DropSettle) => void
  /** Let go, keeping the order it was dragged to. */
  onDrop: (order: string[]) => void
}

export interface CardDrag {
  /** The card dragged, and the order it has moved the cards to, as rendered; null while none is. */
  drag: Drag | null
  /** The cards under the dragged one, which don't bend what is behind them. */
  under: ReadonlySet<string>
  /** The card dragged right now, ahead of the render that shows it. */
  draggedId: () => string | undefined
  /** From a press on a card's header: drags it once the pointer has moved a few px. */
  start: (event: ReactPointerEvent, id: string) => void
  /**
   * Tells it what the grid shows once a render is laid out: a card dragged
   * past another is laid out afresh, and still under the pointer.
   */
  afterLayout: (view: CardGridLayout) => void
}

/**
 * Drags a CardGrid's cards by their headers. It lifts the card over the others
 * and moves it through the grid, never past its edges, however far the
 * pointer goes: as the place it is held by passes over another card, it takes
 * that card's place (`drag.order`) and the rest glide aside. The cards under
 * it are shaded and blurred by how much it covers them. Letting go keeps the
 * order (`onDrop`); Escape, or the pointer cancelling, puts everything back.
 *
 * It does its work once a frame, just before the frame is drawn, with the
 * pointer where it last was, however many moves came since. Only the pointer
 * that took hold drags; scrolling keeps the card under a still pointer.
 * Inside a GlassBackdrop, the backdrop follows the card and the glass on it
 * without re-measuring the rest.
 */
export function useCardDrag(
  gridRef: RefObject<HTMLElement | null>,
  cards: RefObject<ReadonlyMap<string, HTMLElement>>,
  options: CardDragOptions,
): CardDrag {
  const [drag, setDrag] = useState<Drag | null>(null)
  const [under, setUnder] = useState<ReadonlySet<string>>(() => new Set())
  const backdrop = useContext(BackdropContext)
  const session = useRef<DragSession | null>(null)
  // Listens to the press under way, from pointerdown, before it is a drag as well as during one.
  const press = useRef<AbortController | null>(null)
  // For the window listeners, which outlive the render they were made in.
  const willChange = useHandler(options.willChange)
  const onDrop = useHandler(options.onDrop)
  const view = useRef<CardGridLayout>(EMPTY_LAYOUT)

  useEffect(
    () => () => {
      session.current?.stop()
      press.current?.abort()
      press.current = null
    },
    [],
  )

  /**
   * Draws the dragged card with the pointer where it took hold of it, kept
   * inside the grid, and the cards under it covered. Everything is read before
   * anything is written, so no write has the next read lay the page out
   * afresh. Returns where the card is held, in the grid's px (the pointer,
   * until it goes past the grid's edge), and where the other cards are laid
   * out, for passing them.
   */
  function follow(s: DragSession) {
    const el = cards.current.get(s.id)
    const grid = gridRef.current
    if (!el || !grid) return null
    const frame = gridFrame(grid)
    s.laid ??= {
      at: laidOut(el),
      others: shownCards(view.current).flatMap((id) => {
        const other = cards.current.get(id)
        return id !== s.id && other ? [[id, laidOut(other)] as [string, Rect]] : []
      }),
      width: grid.clientWidth,
      height: grid.clientHeight,
    }
    const { at, others, width, height } = s.laid
    const pointer = inGrid(frame, s.pointer)
    const drawn = {
      ...at,
      left: clamp(pointer.x - s.grab.x, 0, width - at.width),
      top: clamp(pointer.y - s.grab.y, 0, height - at.height),
    }
    // Its streaks ride along with it, so it moves on its own layer without
    // being repainted; they slide back into line as it glides home.
    el.style.translate = `${drawn.left - at.left}px ${drawn.top - at.top}px`
    coverUnder(s, drawn, others)
    return { held: { x: drawn.left + s.grab.x, y: drawn.top + s.grab.y }, others }
  }

  /** Shades and blurs each of `others` under the dragged one, drawn at `drawn`, by how much of it is covered. */
  function coverUnder(s: DragSession, drawn: Rect, others: [string, Rect][]) {
    let comesOrGoes = false
    for (const [id, laid] of others) {
      const el = cards.current.get(id)
      if (!el) continue
      const covered = toStep(coverage(drawn, laid), COVERED_STEP)
      const was = s.covered.get(id) ?? 0
      if (covered === was) continue
      showCovered(el, covered, s.blur)
      if (covered === 0) fadeBendIn(el)
      comesOrGoes ||= covered === 0 || was === 0
      if (covered > 0) s.covered.set(id, covered)
      else s.covered.delete(id)
    }
    // Only as a card comes under it or leaves: the bend is set by render.
    if (comesOrGoes) setUnder(new Set(s.covered.keys()))
  }

  /** Moves the dragged card to the place of any of `others` it is held over, at `held` in the grid's px. */
  function pass(s: DragSession, held: { x: number; y: number }, others: [string, Rect][]) {
    const over = cardAt(others, held.x, held.y)
    if (over === s.passed) return
    s.passed = over
    if (over === null) return
    willChange()
    s.order = moveCard(s.order, s.id, over)
    setDrag({ id: s.id, order: s.order })
  }

  function start(event: ReactPointerEvent, id: string) {
    const el = cards.current.get(id)
    if (event.button !== 0 || press.current || !el) return
    if ((event.target as Element).closest('button')) return
    const from = { x: event.clientX, y: event.clientY }
    // Only this pointer drags: another finger, or a pen, is left alone.
    const { pointerId } = event
    const controller = new AbortController()
    press.current = controller
    let s: DragSession | null = null
    let frame = 0

    /** A frame's work: with the pointer where it last was. */
    function step() {
      frame = 0
      if (!s) return
      const followed = follow(s)
      if (followed) pass(s, followed.held, followed.others)
    }

    function begin(): DragSession {
      // From wherever it is drawn, should it still be gliding into place.
      const box = gridFrame(gridRef.current!)
      const drawn = drawnAt(el!, box)
      const held = inGrid(box, from)
      halt(el!)
      stopSpring(el!)
      // The backdrop follows it, and the glass on it, without re-measuring the rest.
      const still = backdrop?.moving(el!, { lifted: true })
      const begun: DragSession = {
        id,
        pointer: from,
        grab: { x: held.x - drawn.left, y: held.y - drawn.top },
        passed: null,
        order: view.current.order,
        blur: readCssNumber(getComputedStyle(gridRef.current!), '--prism-card-grid-under-blur', 0),
        covered: new Map(),
        laid: null,
        stop: () => {
          controller.abort()
          cancelAnimationFrame(frame)
          still?.()
        },
      }
      session.current = begun
      setDrag({ id, order: begun.order })
      return begun
    }

    function finish(keepOrder: boolean) {
      controller.abort()
      press.current = null
      if (!s) return
      // The last move, should its frame not have come yet: done now, and the
      // frame called off, or it would draw the card back under the pointer
      // once it had been let go.
      if (frame) {
        cancelAnimationFrame(frame)
        step()
      }
      s.stop()
      session.current = null
      // Uncovered once laid out, when the grid no longer drags, so they settle on its slower timing.
      willChange({ uncover: { ids: [...s.covered.keys()], blur: s.blur }, dropped: s.id })
      setDrag(null)
      if (s.covered.size) setUnder(new Set())
      if (keepOrder) onDrop(s.order)
    }

    const { signal } = controller
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerId !== pointerId) return
        // Its button is up, though no pointerup came (let go over an iframe, say): let go now.
        if (e.pointerType === 'mouse' && !(e.buttons & 1)) return finish(true)
        if (!s && Math.hypot(e.clientX - from.x, e.clientY - from.y) < DRAG_SLOP) return
        s ??= begin()
        s.pointer = { x: e.clientX, y: e.clientY }
        frame ||= requestAnimationFrame(step)
      },
      { signal },
    )
    // Scrolling moves the grid under a still pointer: the card stays with the pointer.
    window.addEventListener(
      'scroll',
      () => {
        if (s) frame ||= requestAnimationFrame(step)
      },
      { capture: true, passive: true, signal },
    )
    window.addEventListener('pointerup', (e) => e.pointerId === pointerId && finish(true), { signal })
    window.addEventListener('pointercancel', (e) => e.pointerId === pointerId && finish(false), { signal })
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape' || !s) return
        e.preventDefault()
        finish(false)
      },
      { signal },
    )
  }

  return {
    drag,
    under,
    draggedId: () => session.current?.id,
    start,
    afterLayout(next) {
      view.current = next
      // Laid out afresh as it passed another: still under the pointer. Its order
      // is the one shown, so cards that came or went meanwhile are in it.
      if (session.current && drag) {
        session.current.order = next.order
        session.current.laid = null
        follow(session.current)
      }
    },
  }
}
