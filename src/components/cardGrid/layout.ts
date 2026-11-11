// The arrangement of a CardGrid's cards, apart from how it is drawn: the order
// they are laid out in, which are docked in the tray and which, if any, fills
// the grid. Each change gives a new layout and leaves the old as it was.

export interface CardGridLayout {
  /** Every card's id, in the order they are laid out, docked ones included. */
  order: string[]
  /** The ids of the cards docked in the tray, in the order they were docked; the tray shows them in `order`'s. */
  minimised: string[]
  /** The id of the card filling the grid, if any. */
  maximised: string | null
}

/** A box in px, relative to the grid. */
export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export const EMPTY_LAYOUT: CardGridLayout = { order: [], minimised: [], maximised: null }

/**
 * `layout` for the cards `ids`: ones it doesn't name go at the end of the order,
 * and ones no longer there are dropped. A maximised card that is docked or gone
 * no longer fills the grid.
 */
export function settleLayout(layout: CardGridLayout, ids: string[]): CardGridLayout {
  const present = new Set(ids)
  const order = layout.order.filter((id) => present.has(id))
  const ordered = new Set(order)
  order.push(...ids.filter((id) => !ordered.has(id)))
  const minimised = layout.minimised.filter((id) => present.has(id))
  const maximised =
    layout.maximised !== null && present.has(layout.maximised) && !minimised.includes(layout.maximised)
      ? layout.maximised
      : null
  return { order, minimised, maximised }
}

/** Whether the card shows in the grid: not docked, and either nothing fills the grid or it does. */
export function isShown(layout: CardGridLayout, id: string) {
  return !layout.minimised.includes(id) && (layout.maximised === null || layout.maximised === id)
}

/** The ids of the cards that show in the grid, in order. */
export function shownCards(layout: CardGridLayout) {
  return layout.order.filter((id) => isShown(layout, id))
}

/** `order` with `id` moved to where `target` is: after it when coming from before, before it when from after. */
export function moveCard(order: string[], id: string, target: string): string[] {
  const from = order.indexOf(id)
  const to = order.indexOf(target)
  if (from < 0 || to < 0 || from === to) return order
  const next = order.filter((other) => other !== id)
  next.splice(to, 0, id)
  return next
}

/**
 * `order` with `id` moved to the place of the shown card `step` places from it
 * (-1 back one, 1 on one, a row's worth of columns for a row), for the
 * keyboard; as it was where there is none that far.
 */
export function stepCard(layout: CardGridLayout, id: string, step: number): string[] {
  const shown = shownCards(layout)
  const target = shown[shown.indexOf(id) + step]
  return target === undefined ? layout.order : moveCard(layout.order, id, target)
}

/** `layout` with `id` docked in the tray. */
export function minimiseCard(layout: CardGridLayout, id: string): CardGridLayout {
  if (layout.minimised.includes(id)) return layout
  return {
    ...layout,
    minimised: [...layout.minimised, id],
    maximised: layout.maximised === id ? null : layout.maximised,
  }
}

/** `layout` with `id` back from the tray, and the grid showing every card again. */
export function restoreCard(layout: CardGridLayout, id: string): CardGridLayout {
  return { ...layout, minimised: layout.minimised.filter((other) => other !== id), maximised: null }
}

/** `layout` with `id` filling the grid, or, if it already does, back among the others. */
export function toggleMaximised(layout: CardGridLayout, id: string): CardGridLayout {
  return { ...layout, maximised: layout.maximised === id ? null : id }
}

/** How much of `card` the box `over` covers, from 0 to 1. */
export function coverage(over: Rect, card: Rect): number {
  const width = Math.min(over.left + over.width, card.left + card.width) - Math.max(over.left, card.left)
  const height = Math.min(over.top + over.height, card.top + card.height) - Math.max(over.top, card.top)
  if (width <= 0 || height <= 0 || !card.width || !card.height) return 0
  return (width * height) / (card.width * card.height)
}

/** The id of the first box in `rects` holding the point, if any. */
export function cardAt(rects: Iterable<[string, Rect]>, x: number, y: number): string | null {
  for (const [id, r] of rects) {
    if (x >= r.left && x < r.left + r.width && y >= r.top && y < r.top + r.height) return id
  }
  return null
}
