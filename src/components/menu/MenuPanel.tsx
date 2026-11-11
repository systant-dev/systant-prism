import { useId, useRef, type KeyboardEvent, type MouseEvent, type Ref } from 'react'
import { Popup, type PopupAnchor, type PopupProps } from '../popup'
import { ScrollArea } from '../scroll'
import { cx, useForwardedRef } from '../../shared'
import { rowsOf, type MenuEntry, type MenuRow, type MenuSlider } from './menuEntries'
import { MenuRowLine } from './MenuRowLine'
import { MenuSliderRow } from './MenuSliderRow'
import { focusableRows, rowForKey, rowForTyping } from './navigation'
import { useSubmenus } from './useSubmenus'

/** How long a pause ends what is being typed, in ms. */
const TYPING_ENDS_AFTER = 500

/** The keys a slider keeps for itself while it has the focus. The up and down arrows still move through the rows. */
const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'])

/** The list's padding, in px: how far a submenu rises to line its first row up with the row that opened it. */
const LIST_PADDING = 4

/** Whether a row opens a submenu: a disabled one doesn't, nor does one with nothing to show. */
function opens(row: MenuRow | undefined) {
  return row?.type === 'submenu' && !row.disabled && row.items.length > 0
}

/** What every menu of a tree shares. */
export interface MenuRoot {
  /** Closes the whole tree and hands the focus back. */
  close: () => void
  submenuDelay: number
  submenuOffset: number
}

export interface MenuPanelProps extends Omit<PopupProps, 'children' | 'padding'> {
  items: readonly MenuEntry[]
  root: MenuRoot
  /** The list's element. */
  listRef?: Ref<HTMLDivElement>
  /** Asks a submenu to go back to the menu it came from: left in text running left to right. */
  onBack?: () => void
}

// One menu of a tree: a Popup holding the list of rows, and after the list, in the
// popup but not the list, a further MenuPanel per submenu. So a submenu counts as
// inside its menu for presses outside and for Escape (Popup.tsx), and yet what
// happens in it never reaches the list's handlers. Each stays mounted, as a Popup's
// content does, and so fades out when it closes. It lies over the row that opened
// it, and slides out of that row from the side it opens on (Menu.styles.ts).
export function MenuPanel({
  items,
  root,
  listRef,
  onBack,
  open,
  highlight,
  refract,
  readableText,
  className,
  onContextMenu,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...popup
}: MenuPanelProps) {
  const list = useForwardedRef(listRef)
  const id = useId()
  const submenus = useSubmenus(open, root.submenuDelay, list)
  const typed = useRef({ text: '', at: -Infinity })
  const rows = rowsOf(items)

  function choose(row: Exclude<MenuRow, MenuSlider>, index: number) {
    if (row.disabled) return
    if (row.type === 'submenu') return opens(row) ? submenus.show(index) : undefined
    // Before onSelect, which may move the focus on to something it opens.
    if (!row.keepOpen) root.close()
    row.onSelect?.()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return
    const { key } = event
    const focusable = focusableRows(event.currentTarget)
    const focused = document.activeElement as HTMLElement
    const at = focusable.indexOf(focused)
    const index = submenus.rows.current.indexOf(focused)
    const row = rows[index]
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const labels = focusable.map((el) => el.dataset.label ?? '')
    const typing = event.timeStamp - typed.current.at < TYPING_ENDS_AFTER
    // Space goes on with what is being typed only if a label does: "o" and Space chooses Ocean, as nothing starts "o ".
    const spacing = key === ' ' && typing && rowForTyping(labels, `${typed.current.text} `, at) >= 0

    // Not held back: the focus has gone back, so Tab goes on from what opened the menu.
    if (key === 'Tab') return root.close()
    if (row?.type === 'slider' && SLIDER_KEYS.has(key)) return

    const next = rowForKey(key, at, focusable.length)
    if (next !== undefined) {
      event.preventDefault()
      submenus.hide()
      focusable[next].focus()
    } else if (key === (rtl ? 'ArrowRight' : 'ArrowLeft') && onBack) {
      event.preventDefault()
      onBack()
    } else if (key === (rtl ? 'ArrowLeft' : 'ArrowRight') && opens(row)) {
      event.preventDefault()
      submenus.enter(index, 'first')
    } else if (key === 'Enter' || (key === ' ' && !spacing)) {
      event.preventDefault()
      if (opens(row)) submenus.enter(index, 'first')
      // A click, as a link has to go somewhere.
      else if (row) focused.click()
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      const text = (typing ? typed.current.text : '') + key
      typed.current = { text, at: event.timeStamp }
      const found = rowForTyping(labels, text, at)
      if (found >= 0) {
        submenus.hide()
        focusable[found].focus()
      }
    }
  }

  // The browser's own menu has no place over a menu, nor does the menu of anything it is rendered inside.
  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    onContextMenu?.(event)
    event.preventDefault()
    event.stopPropagation()
  }

  // Where each entry's rows begin in `rows`, which counts through the groups and past the separators.
  const starts: number[] = []
  let count = 0
  for (const entry of items) {
    starts.push(count)
    if (entry.type !== 'separator') count += entry.type === 'group' ? entry.items.length : 1
  }

  /** A row, and its place in `rows`. */
  const line = (row: MenuRow, index: number) => {
    const ref = (el: HTMLElement | null) => {
      submenus.rows.current[index] = el
    }
    if (row.type === 'slider') {
      return (
        <MenuSliderRow
          key={index}
          ref={ref}
          row={row}
          onPointerMove={(event) => submenus.pointerMove(event, index, false)}
          // A drag goes on past the row's edges, and the slider has to keep the focus for it to.
          onPointerLeave={(event) => event.buttons || submenus.pointerLeave(event, index)}
        />
      )
    }
    return (
      <MenuRowLine
        key={index}
        ref={ref}
        row={row}
        controls={row.type === 'submenu' ? `${id}-${index}` : undefined}
        expanded={submenus.submenu?.index === index}
        onClick={() => choose(row, index)}
        onPointerMove={(event) => submenus.pointerMove(event, index, opens(row))}
        onPointerLeave={(event) => submenus.pointerLeave(event, index)}
      />
    )
  }

  return (
    <Popup
      {...popup}
      open={open}
      padding="none"
      highlight={highlight}
      refract={refract}
      readableText={readableText}
      className={cx('prism-menu', className)}
      onContextMenu={handleContextMenu}
    >
      {/* tabIndex: the rows are reached with the arrow keys, and the scroller would be a Tab stop of its own */}
      <ScrollArea className="prism-menu__scroll" viewportProps={{ tabIndex: -1 }}>
        <div
          ref={list}
          role="menu"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="prism-menu__list"
          onKeyDown={handleKeyDown}
        >
          {items.map((entry, i) => {
            if (entry.type === 'separator')
              return <div key={`line ${i}`} role="separator" className="prism-menu__line" />
            if (entry.type !== 'group') return line(entry, starts[i])
            return (
              <div
                key={`group ${i}`}
                role="group"
                aria-labelledby={entry.label ? `${id}-group-${i}` : undefined}
                className="prism-menu__group"
              >
                {entry.label && (
                  <div id={`${id}-group-${i}`} className="prism-menu__heading">
                    {entry.label}
                  </div>
                )}
                {entry.items.map((row, at) => line(row, starts[i] + at))}
              </div>
            )
          })}
        </div>
      </ScrollArea>
      {rows.map((row, index) => {
        if (row.type !== 'submenu' || !opens(row)) return null
        // Read as it is placed: by then the row is on the page.
        const anchor: PopupAnchor = {
          get current() {
            return submenus.rows.current[index]
          },
        }
        return (
          <MenuPanel
            key={index}
            ref={(el) => {
              submenus.panels.current[index] = el
            }}
            id={`${id}-${index}`}
            items={row.items}
            root={root}
            open={open && submenus.submenu?.index === index}
            onClose={submenus.hide}
            onBack={() => {
              submenus.hide()
              submenus.rows.current[index]?.focus()
            }}
            anchor={anchor}
            side={submenus.submenu?.index === index ? submenus.submenu.side : 'right'}
            align="start"
            offset={root.submenuOffset}
            alignOffset={-LIST_PADDING}
            highlight={highlight}
            refract={refract}
            readableText={readableText}
            className="prism-menu--submenu"
            aria-label={row.label}
            onPointerEnter={submenus.reached}
          />
        )
      })}
    </Popup>
  )
}
