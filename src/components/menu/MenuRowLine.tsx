import type { HTMLAttributes, Ref } from 'react'
import { Chevron, cx, Tick } from '../../shared'
import type { MenuRow, MenuSlider } from './menuEntries'

type LineRow = Exclude<MenuRow, MenuSlider>

const ROLES: Record<NonNullable<LineRow['type']>, string> = {
  item: 'menuitem',
  submenu: 'menuitem',
  checkbox: 'menuitemcheckbox',
  radio: 'menuitemradio',
}

interface MenuRowLineProps extends Pick<HTMLAttributes<HTMLElement>, 'onClick' | 'onPointerMove' | 'onPointerLeave'> {
  row: LineRow
  /** The id of its submenu, if it has one. */
  controls?: string
  /** Whether its submenu is open. */
  expanded?: boolean
  ref: Ref<HTMLElement>
}

// One row of a menu: a line of four columns, shared by every row (Menu.styles.ts),
// so the labels and whatever follows them line up whichever rows have what. A
// checkbox or radio that is on has a tick at its end, as a Combobox's selected
// entry does, and keeps that column while off, so ticking it moves nothing.
//
// A disabled row can't take the focus, as a menu's arrow keys pass over it.
export function MenuRowLine({ row, controls, expanded, ref, ...handlers }: MenuRowLineProps) {
  const submenu = row.type === 'submenu'
  const on = row.type === 'checkbox' || row.type === 'radio' ? row.checked : undefined
  const link = row.type === undefined || row.type === 'item' ? row : null
  const shortcut = row.type === 'submenu' ? null : row.shortcut

  const props = {
    role: ROLES[row.type ?? 'item'],
    tabIndex: row.disabled ? undefined : -1,
    'aria-disabled': row.disabled || undefined,
    'aria-checked': on,
    'aria-haspopup': submenu ? ('menu' as const) : undefined,
    'aria-expanded': submenu ? expanded : undefined,
    'aria-controls': controls,
    'data-label': row.label,
    className: cx('prism-menu__item', link?.danger && 'prism-menu__item--danger'),
    ...handlers,
  }
  const content = (
    <>
      {row.icon && <span className="prism-menu__lead">{row.icon}</span>}
      <span className="prism-menu__label">{row.label}</span>
      {shortcut && <span className="prism-menu__shortcut">{shortcut}</span>}
      {on !== undefined && <span className="prism-menu__tick">{on && <Tick />}</span>}
      {submenu && (
        <span className="prism-menu__chevron">
          <Chevron />
        </span>
      )}
    </>
  )

  if (link?.href && !row.disabled) {
    return (
      <a
        ref={ref as Ref<HTMLAnchorElement>}
        href={link.href}
        target={link.target}
        // A page opened in a new tab gets no hold on this one (window.opener), which it could
        // send somewhere else behind the reader's back. Browsers now leave it out themselves.
        rel={link.target === '_blank' ? 'noopener' : undefined}
        {...props}
      >
        {content}
      </a>
    )
  }
  return (
    <div ref={ref as Ref<HTMLDivElement>} {...props}>
      {content}
    </div>
  )
}
