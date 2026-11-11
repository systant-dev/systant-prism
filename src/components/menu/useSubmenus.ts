import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { PopupSide } from '../popup'
import { focusMenu, type MenuFocus } from './navigation'
import { inTriangle, safeArea, type Triangle } from './safeArea'

/** How long the pointer has to get from a submenu's row to the submenu, in ms, however slowly. */
const SAFE_FOR = 300

/**
 * Which submenu of a menu is open, and all that opens and closes it. At most one
 * is, known by its row's place among the menu's rows. It goes with the menu.
 *
 * A row the pointer rests on takes the focus, so a pointer and the keyboard share
 * one highlight. After `delay` a submenu's row opens its submenu and any other
 * row closes the one that is open, so a pointer passing over them changes nothing.
 * While the pointer crosses the rows between an open submenu's row and the
 * submenu (safeArea.ts) they are left alone, for as long as SAFE_FOR.
 */
export function useSubmenus(open: boolean, delay: number, list: RefObject<HTMLElement | null>) {
  const [submenu, setSubmenu] = useState<{ index: number; side: PopupSide } | null>(null)
  if (!open && submenu) setSubmenu(null)

  /** Each row's element and each submenu's popup, by the row's place. */
  const rows = useRef<(HTMLElement | null)[]>([])
  const panels = useRef<(HTMLElement | null)[]>([])

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  /** What the timer is for, so a pointer moving on towards the same thing doesn't start it again. */
  const waitingFor = useRef<string | null>(null)
  const safe = useRef<{ area: Triangle; until: number } | null>(null)

  function cancel() {
    clearTimeout(timer.current)
    waitingFor.current = null
  }

  function after(reason: string, ms: number, action: () => void) {
    if (waitingFor.current === reason) return
    cancel()
    waitingFor.current = reason
    timer.current = setTimeout(() => {
      waitingFor.current = null
      action()
    }, ms)
  }

  useEffect(() => {
    if (!open) return
    return () => {
      clearTimeout(timer.current)
      waitingFor.current = null
      safe.current = null
    }
  }, [open])

  /** Opens a submenu, on the side the text runs towards. It flips where it doesn't fit (placePopup.ts). */
  function show(index: number) {
    cancel()
    setSubmenu({ index, side: getComputedStyle(list.current!).direction === 'rtl' ? 'left' : 'right' })
  }

  function hide() {
    cancel()
    setSubmenu(null)
  }

  /** Opens a submenu, if it isn't, and moves the focus to it: the keyboard's way in. */
  function enter(index: number, where: MenuFocus) {
    flushSync(() => show(index))
    const inner = panels.current[index]?.querySelector<HTMLElement>('[role="menu"]')
    if (inner) focusMenu(inner, where)
  }

  // The pointer has come to rest on a row, or at least isn't heading past it.
  function settle(index: number, opens: boolean) {
    const row = rows.current[index]
    if (row && !row.hasAttribute('aria-disabled')) {
      if (document.activeElement !== row) row.focus({ preventScroll: true })
    } else {
      list.current?.focus({ preventScroll: true })
    }
    if (opens) {
      if (submenu?.index === index) cancel()
      else after(`open ${index}`, delay, () => show(index))
    } else if (submenu) {
      after('close', delay, hide)
    } else {
      cancel()
    }
  }

  // Moves, not enters: a row that scrolls under a still pointer gets no pointerenter.
  function pointerMove(event: PointerEvent, index: number, opens: boolean) {
    if (event.pointerType === 'touch') return
    const zone = safe.current
    if (zone) {
      const left = zone.until - performance.now()
      if (left > 0 && inTriangle({ x: event.clientX, y: event.clientY }, zone.area)) {
        // Should it stop here, the row gets its turn once the time is up.
        return after(`safe ${index}`, left, () => {
          safe.current = null
          settle(index, opens)
        })
      }
      safe.current = null
    }
    settle(index, opens)
  }

  function pointerLeave(event: PointerEvent, index: number) {
    if (event.pointerType === 'touch') return
    if (submenu?.index === index) {
      const panel = panels.current[index]
      if (panel) {
        const from = { x: event.clientX, y: event.clientY }
        safe.current = { area: safeArea(from, panel.getBoundingClientRect()), until: performance.now() + SAFE_FOR }
      }
      return
    }
    if (waitingFor.current === `open ${index}`) cancel()
    // Nothing is lit once the pointer is off the rows: on a separator, say.
    if (!submenu && document.activeElement === rows.current[index]) list.current?.focus({ preventScroll: true })
  }

  /** The pointer has reached the submenu, so it stays. */
  function reached() {
    cancel()
    safe.current = null
  }

  return { submenu, rows, panels, show, hide, enter, pointerMove, pointerLeave, reached }
}
