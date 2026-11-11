import type { ReactNode } from 'react'

interface MenuLine {
  /** What it shows as, and what typing is matched against. */
  label: string
  /** Shown at the line's start: a small icon, sized by you. */
  icon?: ReactNode
  disabled?: boolean
}

interface MenuChoice extends MenuLine {
  /** Called as it is chosen, by a press, Enter or Space. */
  onSelect?: () => void
  /** Leaves the menu open once chosen. */
  keepOpen?: boolean
  /** A key combination to show at the line's end. Only shown: the menu doesn't listen for it. */
  shortcut?: string
}

/** A line that does something as it is chosen, or goes somewhere with `href`. */
export interface MenuAction extends MenuChoice {
  type?: 'item'
  /** Marks it as hard to undo, in red. */
  danger?: boolean
  /** Makes it a link. */
  href?: string
  target?: string
}

/** A line that is on or off, with a tick at its end while on. It keeps no state: `onSelect` changes `checked`. */
export interface MenuCheckbox extends MenuChoice {
  type: 'checkbox'
  checked: boolean
}

/** One of a set of lines, the one that is on with a tick. Put the set in a group; `onSelect` changes `checked`. */
export interface MenuRadio extends MenuChoice {
  type: 'radio'
  checked: boolean
}

/**
 * A line with a slider under it and its value at its end, for a number in a range.
 * It is never chosen, and leaves the menu open. It keeps no state: `onChange` changes `value`.
 */
export interface MenuSlider extends MenuLine {
  type: 'slider'
  value: number
  /** 0 if left out. */
  min?: number
  /** 100 if left out. */
  max?: number
  /** How far apart the values it can take are, and how far an arrow key moves it. 1 if left out. */
  step?: number
  /** Called with the new value, all the way through a drag. */
  onChange?: (value: number) => void
  /** What the value shows as, and what a screen reader says for it. */
  format?: (value: number) => string
}

/** A line that opens a menu of its own beside it. */
export interface MenuSubmenu extends MenuLine {
  type: 'submenu'
  items: readonly MenuEntry[]
}

/** A line across the menu. */
export interface MenuSeparator {
  type: 'separator'
}

/** Lines that belong together, under a small heading if it has a `label`. */
export interface MenuGroup {
  type: 'group'
  label?: string
  items: readonly MenuRow[]
}

/** A line the focus can come to. */
export type MenuRow = MenuAction | MenuCheckbox | MenuRadio | MenuSlider | MenuSubmenu

export type MenuEntry = MenuRow | MenuSeparator | MenuGroup

/** The lines of a menu the focus can come to, through its groups, in order. */
export function rowsOf(items: readonly MenuEntry[]): MenuRow[] {
  return items.flatMap((entry) => {
    if (entry.type === 'separator') return []
    return entry.type === 'group' ? entry.items : [entry]
  })
}
