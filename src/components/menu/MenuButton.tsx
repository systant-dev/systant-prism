import { useId, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Button, type ButtonProps } from '../button'
import { useForwardedRef } from '../../shared'
import { Menu, type MenuProps } from './Menu'
import type { MenuFocus } from './navigation'

export interface MenuButtonProps extends Omit<ButtonProps, 'aria-haspopup' | 'aria-expanded' | 'aria-controls'> {
  /** Its menu's rows, separators and groups. */
  items: MenuProps['items']
  /** Which side of the button the menu opens on, if it fits there. */
  side?: MenuProps['side']
  /** How the menu lines up along the button. */
  align?: MenuProps['align']
  /** Anything else for the menu. */
  menuProps?: Omit<MenuProps, 'items' | 'open' | 'onClose' | 'anchor' | 'side' | 'align' | 'focusOnOpen'>
}

// A Button that opens a Menu under it and keeps its own open state, for the usual
// case. Its props are a Button's, `ref` included, and name the menu after it.
//
// As the menu button pattern has it, Enter and Space open it on the first row, the
// down arrow too, and the up arrow on the last. A press opens it with no row lit,
// and closes it again.
export function MenuButton({
  items,
  side,
  align,
  menuProps,
  id,
  onClick,
  onKeyDown,
  disabled,
  ref,
  ...rest
}: MenuButtonProps) {
  const button = useForwardedRef(ref)
  const [open, setOpen] = useState(false)
  const [focusOnOpen, setFocusOnOpen] = useState<MenuFocus>('menu')
  const ownId = useId()
  const buttonId = id ?? ownId
  const menuId = `${buttonId}-menu`

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event)
    if (event.defaultPrevented) return
    // Safari leaves the focus where it was on a press, and the menu hands it back to where it was.
    event.currentTarget.focus()
    // A click of no clicks is Enter or Space.
    setFocusOnOpen(event.detail === 0 ? 'first' : 'menu')
    setOpen(!open)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented || open) return
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    setFocusOnOpen(event.key === 'ArrowDown' ? 'first' : 'last')
    setOpen(true)
  }

  return (
    <>
      <Button
        {...rest}
        ref={button}
        id={buttonId}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      />
      <Menu
        aria-labelledby={buttonId}
        {...menuProps}
        id={menuId}
        items={items}
        open={open}
        onClose={() => setOpen(false)}
        anchor={button}
        side={side}
        align={align}
        focusOnOpen={focusOnOpen}
      />
    </>
  )
}
