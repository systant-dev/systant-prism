import { fold } from '../../shared'

/** Which row a menu opens with the focus on, or 'menu' for the menu itself, with none lit. */
export type MenuFocus = 'menu' | 'first' | 'last'

/** The rows of a menu that can take the focus, in order, without those of any menu inside it. */
export function focusableRows(list: HTMLElement) {
  return [...list.querySelectorAll<HTMLElement>('[role^="menuitem"], [role="slider"]')].filter(
    (row) => row.getAttribute('aria-disabled') !== 'true',
  )
}

/** Puts the focus on `list`, or on its first or last row. */
export function focusMenu(list: HTMLElement, where: MenuFocus) {
  const rows = focusableRows(list)
  const row = where === 'first' ? rows[0] : where === 'last' ? rows.at(-1) : undefined
  if (row) row.focus()
  else list.focus({ preventScroll: true })
}

/**
 * Which of `count` rows a key moves the focus to, from the one at `at` (-1 while
 * none has it), or undefined for a key that doesn't move it. Up and down go round
 * at the ends, as a menu's do, unlike a selector's.
 */
export function rowForKey(key: string, at: number, count: number) {
  if (count === 0) return
  if (key === 'ArrowDown') return (at + 1) % count
  if (key === 'ArrowUp') return at < 0 ? count - 1 : (at - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
}

/**
 * Which of `labels` what was `typed` picks, from the one at `at` (-1 for none), or
 * -1. The labels are matched from their start, whatever their case and accents,
 * going round from the row with the focus. So typing on keeps the row while it
 * still matches, and one letter pressed over and over steps through those that
 * start with it, past the row with the focus each time.
 */
export function rowForTyping(labels: readonly string[], typed: string, at: number) {
  const wanted = fold(typed)
  const stepping = [...wanted].every((letter) => letter === wanted[0])
  const start = stepping ? at + 1 : Math.max(at, 0)
  const prefix = stepping ? wanted[0] : wanted
  for (let i = 0; i < labels.length; i++) {
    const row = (start + i) % labels.length
    if (fold(labels[row]).startsWith(prefix)) return row
  }
  return -1
}
