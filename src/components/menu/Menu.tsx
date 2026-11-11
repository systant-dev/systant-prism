import { useEffectEvent, useLayoutEffect, useRef } from 'react'
import type { PopupProps } from '../popup'
import { PrismStyles } from '../../shared'
import type { MenuEntry } from './menuEntries'
import { menuStyles } from './Menu.styles'
import { MenuPanel, type MenuRoot } from './MenuPanel'
import { focusMenu, type MenuFocus } from './navigation'

export interface MenuProps extends Omit<PopupProps, 'children' | 'padding'> {
  /** Its rows, separators and groups. A row of type 'submenu' holds entries of its own, to any depth. */
  items: readonly MenuEntry[]
  /**
   * Called when it asks to close: on choosing a row, Tab, Escape or a press
   * outside it and its anchor element.
   */
  onClose?: () => void
  /** Where the focus goes as it opens: a row, or the menu itself, with no row lit but the keys working. */
  focusOnOpen?: MenuFocus
  /** How long the pointer rests on a submenu's row before it opens, in ms. */
  submenuDelay?: number
  /** The gap between a submenu and the row that opened it, in px. Below 0 it lies over the row's edge. */
  submenuOffset?: number
}

// A menu of actions in a Popup (../popup/Popup.tsx): it opens beside an element, or
// at a point for a context menu, and is controlled as a Popup is. A MenuPanel is
// each menu of the tree; this is the tree's root, which owns the focus.
//
// It takes the focus as it opens, unlike a Popup, and rows take it after that, from
// the keyboard and the pointer alike (useSubmenus.ts), so one row is ever lit. As
// the menu pattern has it: the arrows, Home and End move it, going round at the
// ends, and typing moves it to the row that starts with what is typed. Enter and
// Space choose the row. Escape closes the last menu to open (Popup.tsx) and the
// focus goes back to the row that opened it. Tab closes the tree, and goes on from
// what opened it. Choosing a row closes the tree too, unless the row asks to stay,
// and hands the focus back to wherever it was as it opened.
export function Menu({
  items,
  open,
  onClose,
  focusOnOpen = 'menu',
  submenuDelay = 150,
  submenuOffset = -4,
  ...popup
}: MenuProps) {
  const list = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<Element | null>(null)

  const root: MenuRoot = {
    close() {
      if (returnFocus.current instanceof HTMLElement) returnFocus.current.focus({ preventScroll: true })
      onClose?.()
    },
    submenuDelay,
    submenuOffset,
  }

  const takeFocus = useEffectEvent(() => {
    returnFocus.current = document.activeElement
    if (list.current) focusMenu(list.current, focusOnOpen)
  })

  // After the popup's own layout effect, which shows it: nothing hidden can take the focus.
  useLayoutEffect(() => {
    if (open) takeFocus()
  }, [open])

  return (
    <>
      <PrismStyles href="prism-menu" css={menuStyles} />
      <MenuPanel {...popup} items={items} open={open} onClose={onClose} root={root} listRef={list} />
    </>
  )
}
