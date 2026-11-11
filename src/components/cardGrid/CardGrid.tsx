import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { BackdropContext } from '../backdrop'
import type { CardPadding } from '../card'
import { afterFade } from '../fade'
import { scrollbarStyles } from '../scroll'
import { axes } from '../selector'
import { cssVars, cx, motionStyles, PrismStyles, readCssTime, useControllable } from '../../shared'
import { GRACE_MS, playChange, type Change, type ChangeKind } from './change'
import { cardGridStyles } from './CardGrid.styles'
import {
  EMPTY_LAYOUT,
  isShown,
  minimiseCard,
  restoreCard,
  settleLayout,
  shownCards,
  stepCard,
  toggleMaximised,
  type CardGridLayout,
  type Rect,
} from './layout'
import { DockTray, type DockTrayChip } from './DockTray'
import { GridCard, type GridCardActions } from './GridCard'
import { drawnAt, gridFrame, laidOut, lineUpStreaks } from './motion'
import { useCardDrag } from './useCardDrag'

export interface CardGridItem {
  id: string
  /** Shown in the card's header, which it is dragged by, and on its chip while docked. */
  title: ReactNode
  /** The title as text, for the card and its buttons, where `title` isn't a string. */
  label?: string
  content: ReactNode
}

export interface CardGridProps extends Omit<ComponentProps<'div'>, 'children'> {
  items: CardGridItem[]
  /** How the cards are arranged. Leave it out for a grid that keeps its own, from `defaultLayout`. */
  layout?: CardGridLayout
  /** How they start out, while `layout` is left out. Cards it doesn't order go at the end. */
  defaultLayout?: Partial<CardGridLayout>
  /** Called with the new arrangement when a card is moved, docked, restored, maximised or put back. */
  onLayoutChange?: (layout: CardGridLayout) => void
  /** Padding of each card's body. */
  padding?: CardPadding
  /** How many columns, all as wide. Leave it out for as many of at least --prism-card-grid-column as fit. */
  columns?: number
  /**
   * How many rows, all as tall, sharing the grid's height: give it a height or
   * min-height. Cards past rows × columns go on in more rows the same.
   */
  rows?: number
  /** Accessible name of the tray of docked cards. */
  trayLabel?: string
  /** Accessible name of a card's minimise button, from its title. */
  minimiseLabel?: (title: string) => string
  /** Accessible name of a card's maximise button, from its title. */
  maximiseLabel?: (title: string) => string
  /** Accessible name of a docked card's chip, from its title. */
  restoreLabel?: (title: string) => string
  /** What a screen reader hears as the arrow keys move a card, from its title, its place and how many there are. */
  movedLabel?: (title: string, place: number, places: number) => string
  /** Shown faintly in the tray while no card is docked; leave it empty for none. */
  trayPlaceholder?: ReactNode
  /** Give the cards' text and the tray's the page's text colour inside a GlassBackdrop. */
  readableText?: boolean
}

/** A card on its way out, pinned where it was drawn while it fades. */
interface Leaving {
  rect: Rect
  serial: number
}

/** A chip on its way out of the tray, as its card is brought back, kept where it was in it while it fades. */
interface LeavingChip {
  index: number
  /** How wide it was, in px, for it to close up from. */
  width: number | undefined
  serial: number
}

let serial = 0

const minimiseOf = (title: string) => `Minimise ${title}`
const maximiseOf = (title: string) => `Maximise ${title}`
const restoreOf = (title: string) => `Restore ${title}`
const movedTo = (title: string, place: number, places: number) => `${title} moved to place ${place} of ${places}`

function labelOf(item: CardGridItem) {
  return item.label ?? (typeof item.title === 'string' ? item.title : item.id)
}

/** What a render shows, as far as where the cards go: their order, which show, and which is dragged. */
function shownKey(view: CardGridLayout, dragged: string | undefined) {
  return JSON.stringify([view.order, view.minimised, view.maximised, dragged ?? null])
}

/** How many places an arrow key moves a card: along the text's direction, or a row's worth of `columns`. */
function arrowStep(key: string, rtl: boolean, columns: number) {
  if (key === 'ArrowUp') return -columns
  if (key === 'ArrowDown') return columns
  return key === axes.horizontal.steps(rtl).forward ? 1 : -1
}

/** A copy of `map` without `ids`. */
function without<V>(map: ReadonlyMap<string, V>, ids: Iterable<string>): ReadonlyMap<string, V> {
  const rest = new Map(map)
  for (const id of ids) rest.delete(id)
  return rest
}

/** A whole number of columns or rows, at least 1, or undefined for none set. */
function count(n: number | undefined) {
  return n !== undefined && n >= 1 ? Math.floor(n) : undefined
}

// A grid of cards that can be rearranged: each has a header with its title and
// two bare icon buttons, and its content below.
//
// - Dragging a card by its header lifts it over the others and moves it
//   through the grid, never past its edges, however far the pointer goes: as
//   the place it is held by passes over another card, the dragged one
//   takes its place and the rest glide aside. Letting go settles it into its
//   new place; Escape puts everything back. The arrow keys do the same with a
//   card's title focused: left and right one place at a time, following the
//   text's direction, up and down a row's worth of places, and a screen reader
//   hears where it went (`movedLabel`).
// - Minimise docks a card in a tray across the top of the grid, dressed as a
//   horizontal selector (DockTray.tsx), there even while empty, with a faint
//   placeholder (`trayPlaceholder`) saying what it is for: it fades out where it is
//   as its chip fades in there, quickly, and the others close up. Pressing the
//   chip brings it back to its place in the order the same way round: it fades
//   in there as the chip fades out.
// - Maximise has the card fill the grid, over every column: the others fade
//   away where they are, quickly, and then it expands. Pressing it again, or
//   double-clicking the header, puts it back the same way round: it shrinks,
//   and then the others fade back in. Enter or Space on a card's title does
//   as the double-click does, either way.
//
// Docked and hidden cards stay mounted, so their content keeps its state. A
// card's glass moves with it, inside a GlassBackdrop too (see motion.ts for how
// the cards move, and CardGrid.styles.ts for how they look). Each card is a
// memoised GridCard, so a render here re-renders only the cards it changes.
//
// The grid keeps the layout and says how it changes; useCardDrag.ts drags the
// cards, and change.ts plays each change once it is laid out.
//
// `columns` and `rows` fix how many of each there are; without, it fits as many
// columns as it can and makes as many rows as its cards need, each as tall as
// its tallest card.
//
// With `layout` it shows the arrangement it is given and asks for changes
// through `onLayoutChange`, which suits keeping it in storage; without, it
// keeps its own, starting from `defaultLayout`. Cards the layout doesn't order
// go at the end.
export function CardGrid({
  items,
  layout: controlled,
  defaultLayout,
  onLayoutChange,
  padding = 'md',
  trayLabel = 'Minimised cards',
  trayPlaceholder = 'Minimised cards appear here',
  minimiseLabel = minimiseOf,
  maximiseLabel = maximiseOf,
  restoreLabel = restoreOf,
  movedLabel = movedTo,
  readableText = true,
  columns,
  rows,
  className,
  style,
  ...rest
}: CardGridProps) {
  const columnCount = count(columns)
  const rowCount = count(rows)
  const ids = items.map((item) => item.id)
  const byId = new Map(items.map((item) => [item.id, item]))
  const [arranged, keepLayout] = useControllable(controlled, () =>
    settleLayout({ ...EMPTY_LAYOUT, ...defaultLayout }, ids),
  )
  const layout = settleLayout(arranged, ids)
  const [leaving, setLeaving] = useState<ReadonlyMap<string, Leaving>>(() => new Map())
  const [leavingChips, setLeavingChips] = useState<ReadonlyMap<string, LeavingChip>>(() => new Map())
  const [announcement, setAnnouncement] = useState('')
  const backdrop = useContext(BackdropContext)

  const gridRef = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<string, HTMLDivElement>())
  const titles = useRef(new Map<string, HTMLSpanElement>())
  // The chips' elements, which the tray keeps up to date.
  const chips = useRef<ReadonlyMap<string, HTMLButtonElement>>(new Map())
  const change = useRef<Change | null>(null)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  // Ends the backdrop following cards as they glide, for each glide still going.
  const glides = useRef(new Set<() => void>())
  // Stops waiting for the other cards to fade before one is maximised, while they fade: nothing else moves meanwhile.
  const fading = useRef<(() => void) | null>(null)

  const cardDrag = useCardDrag(gridRef, cards, {
    willChange: (settle) => {
      change.current = { ...snapshot(), leaving: [], ...settle }
    },
    onDrop: (dropped) => {
      if (dropped.join('\n') !== layout.order.join('\n')) commit({ ...layout, order: dropped })
    },
  })
  const { drag, under } = cardDrag

  // The order shown: the dragged one where it has got to, while dragging,
  // settled too, so items that come or go mid-drag do so straight away.
  const order = drag ? settleLayout({ ...layout, order: drag.order }, ids).order : layout.order
  const view: CardGridLayout = { ...layout, order }

  // Pinned to leave, but shown after all (kept by a parent, or brought back) or
  // gone: let go before anything is drawn, so a later hide doesn't find it pinned.
  const kept = [...leaving.keys()].filter((id) => !byId.has(id) || isShown(view, id))
  if (kept.length) setLeaving((now) => without(now, kept))
  // Chips fading out, but docked after all (kept by a parent, or docked again) or gone: let go, so one docked shows afresh.
  const keptChips = [...leavingChips.keys()].filter((id) => !byId.has(id) || layout.minimised.includes(id))
  if (keptChips.length) setLeavingChips((now) => without(now, keptChips))
  // The tray: the docked cards' chips, in the order their cards have in the
  // grid rather than the order they were docked, and those fading out where they were.
  const trayChip = (id: string, going: boolean, width?: number): DockTrayChip => {
    const item = byId.get(id)!
    return { id, title: item.title, label: restoreLabel(labelOf(item)), going, width }
  }
  const docked = layout.order.filter((id) => layout.minimised.includes(id))
  const trayChips = docked.map((id) => trayChip(id, false))
  for (const [id, { index, width }] of [...leavingChips].sort(([, a], [, b]) => a.index - b.index)) {
    if (!keptChips.includes(id)) trayChips.splice(Math.min(index, trayChips.length), 0, trayChip(id, true, width))
  }

  function commit(next: CardGridLayout) {
    keepLayout(next)
    onLayoutChange?.(next)
  }

  // For the end of a fade, and resizes, which outlive the render they were heard in.
  // Written after each render, as `latestActions` is, and read by nothing before that.
  const latest = useRef<{
    layout: CardGridLayout
    view: CardGridLayout
    relayout: typeof relayout
    draggedId: typeof cardDrag.draggedId
  }>(null!)
  // What the last render showed (shownKey), so a change is only played once the layout it asked for lands.
  const rendered = useRef('')

  /** Where every card in the page is drawn, relative to the grid. */
  function snapshot(): Pick<Change, 'cards'> {
    const frame = gridFrame(gridRef.current!)
    const drawn = [...cards.current].filter(([, el]) => el.getClientRects().length > 0)
    return { cards: new Map(drawn.map(([id, el]) => [id, drawnAt(el, frame)])) }
  }

  /** Changes the layout to `next`, gliding every card from where it is drawn now. */
  function relayout(next: CardGridLayout, focus?: Change['focus'], kind?: ChangeKind) {
    const before = snapshot()
    const goes = shownCards(layout).filter((id) => !isShown(next, id) && before.cards.has(id))
    change.current = { ...before, leaving: goes, focus, kind }
    // Pinned in the same render as they are hidden, should the change be taken;
    // a parent may keep them instead, and once laid out any still shown are let go.
    if (goes.length) {
      setLeaving((now) => {
        const pinned = new Map(now)
        for (const id of goes) pinned.set(id, { rect: before.cards.get(id)!, serial: ++serial })
        return pinned
      })
    }
    commit(next)
  }

  /**
   * Brings `id` back from the tray: it fades in where it belongs as its chip
   * fades out, the chip kept where it was in the tray meanwhile.
   */
  function undock(id: string) {
    if (fading.current) return
    const grid = gridRef.current
    const ms = grid ? readCssTime(getComputedStyle(grid).getPropertyValue('--prism-card-grid-minimise-duration')) : 0
    const chip = { index: docked.indexOf(id), width: chips.current.get(id)?.offsetWidth, serial: ++serial }
    setLeavingChips((now) => new Map(now).set(id, chip))
    later(ms + GRACE_MS, () =>
      setLeavingChips((now) => (now.get(id)?.serial === chip.serial ? without(now, [id]) : now)),
    )
    relayout(restoreCard(layout, id), { id, on: 'title' }, 'undock')
  }

  /**
   * Has `id` fill the grid in two steps: the other cards fade out where they
   * are, and only then is it maximised, expanding over the room they leave.
   * They stay faded as they leave (see the layout effect), or fade back in
   * should a parent keep the layout as it was.
   */
  function maximise(id: string) {
    const others = shownCards(layout).flatMap((other) => {
      const el = cards.current.get(other)
      return other !== id && el ? [el] : []
    })
    if (!others.length) return relayout(toggleMaximised(layout, id))
    // Done putting one back, should it still be: its timing isn't this fade's.
    gridRef.current?.removeAttribute('data-prism-change')
    for (const el of others) el.toggleAttribute('data-prism-fading', true)
    let faded = false
    const stop = afterFade(others[0], () => {
      faded = true
      fading.current = null
      const { layout: now, relayout: apply } = latest.current
      if (now.maximised === null && isShown(now, id)) apply(toggleMaximised(now, id))
      else for (const el of others) el.removeAttribute('data-prism-fading')
    })
    // With nothing to wait for (no fade, as with reduced motion) it is maximised already.
    if (!faded) fading.current = stop
  }

  /**
   * A change for the shown cards still faded out from leaving (playChange
   * leaves them at opacity 0), each drawn where it is laid out: it only fades
   * in. Null where there are none.
   */
  function fadeBackIn(next: CardGridLayout, dragged: string | undefined): Change | null {
    const shown = shownCards(next).flatMap((id) => {
      const el = cards.current.get(id)
      return el && id !== dragged ? [{ id, el }] : []
    })
    if (!shown.some(({ el }) => el.style.opacity === '0')) return null
    return { cards: new Map(shown.map(({ id, el }) => [id, laidOut(el)])), leaving: [] }
  }

  /** How many columns the grid lays out: as set, or as many as fit. */
  function columnsShown() {
    const grid = gridRef.current
    if (columnCount || !grid) return columnCount ?? 1
    const tracks = getComputedStyle(grid).gridTemplateColumns
    return tracks && tracks !== 'none' ? tracks.trim().split(/\s+/).length : 1
  }

  /** Has the backdrop follow the glass in `el` (the grid's cards) for `ms`, for motion it can't hear. */
  function followFor(el: HTMLElement, ms: number) {
    const stop = backdrop?.moving(el)
    if (!stop) return
    glides.current.add(stop)
    later(ms, () => {
      glides.current.delete(stop)
      stop()
    })
  }

  /** Calls `then` after `ms`, unless the grid goes first. */
  function later(ms: number, then: () => void) {
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      then()
    }, ms)
    timers.current.add(timer)
  }

  // What the cards call, as of this render; they are handed `actions`, which
  // stays the same and calls through to these, so handing it on re-renders none.
  const latestActions = useRef<Omit<GridCardActions, 'card' | 'title'>>(null!)
  const [actions] = useState<GridCardActions>(() => ({
    card: (id, el) => {
      cards.current.set(id, el)
      return () => cards.current.delete(id)
    },
    title: (id, el) => {
      titles.current.set(id, el)
      return () => titles.current.delete(id)
    },
    headerPointerDown: (event, id) => latestActions.current.headerPointerDown(event, id),
    toggleMaximised: (id) => latestActions.current.toggleMaximised(id),
    titleKeyDown: (event, id) => latestActions.current.titleKeyDown(event, id),
    minimise: (id) => latestActions.current.minimise(id),
  }))

  /** Has `id` fill the grid, or puts it back among the others if it does already. */
  function toggleCard(id: string) {
    if (fading.current) return
    if (layout.maximised === null) maximise(id)
    else relayout(toggleMaximised(layout, id), undefined, 'unmaximise')
  }

  function onTitleKeyDown(event: ReactKeyboardEvent, id: string) {
    // The title is a button, so Enter and Space do something: what a double-click on its
    // header does. Not from inside it, where a link in a title has its own Enter.
    if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
      event.preventDefault()
      if (!event.repeat && !drag) toggleCard(id)
      return
    }
    if (!event.key.startsWith('Arrow') || layout.maximised !== null || drag || fading.current) return
    const rtl = getComputedStyle(gridRef.current!).direction === 'rtl'
    event.preventDefault()
    const stepped = stepCard(layout, id, arrowStep(event.key, rtl, columnsShown()))
    if (stepped === layout.order) return
    const next = { ...layout, order: stepped }
    const places = shownCards(next)
    setAnnouncement(movedLabel(labelOf(byId.get(id)!), places.indexOf(id) + 1, places.length))
    relayout(next, { id, on: 'title' })
  }

  useLayoutEffect(() => {
    latest.current = { layout, view, relayout, draggedId: cardDrag.draggedId }
    latestActions.current = {
      headerPointerDown: (event, id) => {
        if (layout.maximised === null && !fading.current) cardDrag.start(event, id)
      },
      toggleMaximised: toggleCard,
      titleKeyDown: onTitleKeyDown,
      minimise: (id) => {
        if (!fading.current) relayout(minimiseCard(layout, id), { id, on: 'chip' })
      },
    }
    const grid = gridRef.current
    // Played only once what it asked for has landed: a render that shows the
    // same as the last (a parent keeping its layout, say) lets it go unplayed.
    const key = shownKey(view, drag?.id)
    let from = key === rendered.current ? null : change.current
    // Shown again by a change of a parent's own (a reset, say) after fading out:
    // nothing of the grid's brings it back, so it fades in where it is, and the rest stay put.
    if (key !== rendered.current && !from) from = fadeBackIn(view, drag?.id)
    rendered.current = key
    change.current = null
    if (grid && from) {
      const played = playChange(grid, from, {
        cards: cards.current,
        view,
        dragged: drag?.id,
        pinned: (id) => leaving.has(id),
      })
      // A card's own transitions are followed by the backdrop, but not the glass
      // inside it (its buttons), so it follows the whole grid until they end.
      if (played.glideMs) followFor(grid, played.glideMs)
      // The backdrop can't hear an animation, so it follows the springs until the last ends.
      if (played.springMs) followFor(grid, played.springMs + GRACE_MS)
      // Let go of once faded out, should they still be leaving then.
      for (const id of played.leaving) {
        const pinned = leaving.get(id)!.serial
        later(played.glideMs, () => setLeaving((now) => (now.get(id)?.serial === pinned ? without(now, [id]) : now)))
      }

      if (from.focus) {
        const target = (from.focus.on === 'chip' ? chips : titles).current.get(from.focus.id)
        target?.focus({ preventScroll: true })
      }
      backdrop?.invalidate()
    }
    // Faded for one to fill the grid, and not left faded above: shown after all
    // (a parent kept the layout as it was), they fade back in; hidden, they are
    // ready to show again.
    if (!fading.current) {
      for (const el of cards.current.values()) el.removeAttribute('data-prism-fading')
    }
    // The streaks of every other card, lined up where it is: on mounting, say.
    // Those of one gliding already head there, so are left to get there.
    for (const id of order) {
      const el = cards.current.get(id)
      if (el && id !== drag?.id && isShown(view, id) && !leaving.has(id)) lineUpStreaks(el, laidOut(el))
    }
    cardDrag.afterLayout(view)
  })

  // A resize lays the cards out afresh without gliding them (the grid narrowing
  // to fewer columns, say), so their streaks are lined up again straight away.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const { view: now, draggedId } = latest.current
      for (const id of shownCards(now)) {
        const el = cards.current.get(id)
        if (el && id !== draggedId()) lineUpStreaks(el, laidOut(el))
      }
    })
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const pending = timers.current
    const gliding = glides.current
    return () => {
      fading.current?.()
      for (const timer of pending) clearTimeout(timer)
      for (const glide of gliding) glide()
    }
  }, [])

  return (
    <>
      <PrismStyles href="prism-motion" css={motionStyles} />
      <PrismStyles href="prism-scrollbar" css={scrollbarStyles} />
      <PrismStyles href="prism-card-grid" css={cardGridStyles} />
      <div
        className={cx(
          'prism-card-grid',
          layout.maximised !== null && 'prism-card-grid--maximised',
          drag && 'prism-card-grid--dragging',
          columnCount !== undefined && 'prism-card-grid--columns',
          rowCount !== undefined && 'prism-card-grid--rows',
          className,
        )}
        style={{
          ...cssVars({ '--prism-card-grid-columns': columnCount, '--prism-card-grid-rows': rowCount }),
          ...style,
        }}
        {...rest}
      >
        <DockTray
          chips={trayChips}
          label={trayLabel}
          placeholder={trayPlaceholder}
          onRestore={undock}
          chipsRef={chips}
          readableText={readableText}
        />
        <div ref={gridRef} className="prism-card-grid__cards">
          {order.map((id) => {
            const item = byId.get(id)!
            const label = labelOf(item)
            const shown = isShown(view, id)
            return (
              <GridCard
                key={id}
                id={id}
                title={item.title}
                label={label}
                minimiseLabel={minimiseLabel(label)}
                maximiseLabel={maximiseLabel(label)}
                content={item.content}
                padding={padding}
                shown={shown}
                pinned={shown ? undefined : leaving.get(id)?.rect}
                maximised={layout.maximised === id}
                dragging={drag?.id === id}
                unbent={under.has(id)}
                readableText={readableText}
                actions={actions}
              />
            )
          })}
        </div>
        <span role="status" className="prism-card-grid__status">
          {announcement}
        </span>
      </div>
    </>
  )
}
