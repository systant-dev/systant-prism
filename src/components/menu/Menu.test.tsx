import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState, type SyntheticEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes } from '../../../test/dom'
import { hover, pointerEvent } from '../../../test/selector'
import { Menu, type MenuProps } from './Menu'
import { MenuButton } from './MenuButton'
import type { MenuEntry, MenuSlider } from './menuEntries'

// jsdom has no popovers, only the stylesheet that hides them, and nothing hidden
// can take the focus. These show each as it should, so focus moved too soon fails
// as it would in a browser, and record whether it is showing.
const showing = new Set<Element>()
const shown = document.createElement('style')
shown.textContent = '[data-showing] { display: block !important; }'

const row = (name: string) => screen.getByText(name).closest<HTMLElement>('[role^="menuitem"]')!
const menuOf = (name: string) => row(name).closest<HTMLElement>('[role="menu"]')!
const popupOf = (name: string) => menuOf(name).closest<HTMLElement>('.prism-popup')!
const shows = (name: string) => showing.has(popupOf(name))
const focused = () => (document.activeElement as HTMLElement).dataset.label
const press = (key: string, init = {}) => fireEvent.keyDown(document.activeElement!, { key, ...init })

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))

const entries: MenuEntry[] = [
  { label: 'Cut', shortcut: 'Ctrl+X' },
  { label: 'Copy', disabled: true },
  { type: 'separator' },
  {
    type: 'submenu',
    label: 'Share',
    items: [{ label: 'Email' }, { type: 'submenu', label: 'More', items: [{ label: 'Fax' }] }],
  },
  { label: 'Delete', danger: true },
]

/**
 * A menu beside a button that opens it, over a 1000 × 800 viewport, with
 * everything 200 × 100 at (100, 100). It keeps its own open state, open to begin with.
 */
function Host({
  items = entries,
  onClose,
  startsOpen = true,
  ...props
}: Partial<MenuProps> & { startsOpen?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(startsOpen)
  return (
    <>
      <button ref={ref} onClick={() => setOpen(true)}>
        Anchor
      </button>
      <button>Elsewhere</button>
      <Menu
        aria-label="Actions"
        items={items}
        open={open}
        onClose={() => {
          setOpen(false)
          onClose?.()
        }}
        anchor={ref}
        {...props}
      />
    </>
  )
}

/** Renders Host, opened with the focus on its anchor. */
function renderFromAnchor(props: Partial<MenuProps> = {}) {
  const view = render(<Host startsOpen={false} {...props} />)
  const anchor = screen.getByRole('button', { name: 'Anchor' })
  anchor.focus()
  fireEvent.click(anchor)
  return view
}

/** Has every element read as being in text that runs right to left. */
function rightToLeft() {
  const real = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
    const style = real(el)
    return new Proxy(style, {
      get: (target, key) => {
        if (key === 'direction') return 'rtl'
        const value = Reflect.get(target, key)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  })
}

beforeEach(() => {
  manualResizes()
  showing.clear()
  document.head.append(shown)
  HTMLElement.prototype.showPopover = function () {
    showing.add(this)
    this.dataset.showing = ''
  }
  HTMLElement.prototype.hidePopover = function () {
    showing.delete(this)
    delete this.dataset.showing
  }
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000)
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 100, y: 100, width: 80, height: 30 }),
  )
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
})

afterEach(() => {
  cleanup()
  shown.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  // @ts-expect-error -- jsdom has none of its own
  delete HTMLElement.prototype.showPopover
  // @ts-expect-error -- as above
  delete HTMLElement.prototype.hidePopover
})

describe('Menu', () => {
  describe('rows', () => {
    it('is a named menu in a popup with no padding', () => {
      render(<Host />)
      expect(menuOf('Cut').getAttribute('aria-label')).toBe('Actions')
      expect([...popupOf('Cut').classList]).toEqual(expect.arrayContaining(['prism-menu', 'prism-popup--pad-none']))
    })

    it('gives each kind of row its role and state', () => {
      render(
        <Host
          items={[
            { label: 'Plain' },
            { label: 'Off', disabled: true },
            { type: 'checkbox', label: 'Ticked', checked: true },
            { type: 'checkbox', label: 'Unticked', checked: false },
            { type: 'radio', label: 'Picked', checked: true },
            { type: 'radio', label: 'Unpicked', checked: false },
          ]}
        />,
      )

      expect(row('Plain').getAttribute('role')).toBe('menuitem')
      expect(row('Plain').hasAttribute('aria-checked')).toBe(false)
      expect(row('Off').getAttribute('aria-disabled')).toBe('true')
      expect(row('Ticked').getAttribute('role')).toBe('menuitemcheckbox')
      expect(row('Ticked').getAttribute('aria-checked')).toBe('true')
      expect(row('Unticked').getAttribute('aria-checked')).toBe('false')
      expect(row('Picked').getAttribute('role')).toBe('menuitemradio')
      expect(row('Unpicked').getAttribute('aria-checked')).toBe('false')
    })

    it.each(['checkbox', 'radio'] as const)('ends a %s with a tick only while on, keeping its column', (type) => {
      render(
        <Host
          items={[
            { type, label: 'On', checked: true },
            { type, label: 'Off', checked: false },
          ]}
        />,
      )
      expect(row('On').querySelector('.prism-menu__tick svg')).not.toBeNull()
      expect(row('On').lastElementChild?.classList.contains('prism-menu__tick')).toBe(true)
      expect(row('Off').querySelector('.prism-menu__tick')).not.toBeNull()
      expect(row('Off').querySelector('.prism-menu__tick svg')).toBeNull()
    })

    it('has no tick on a row that is never on', () => {
      render(<Host />)
      expect(row('Cut').querySelector('.prism-menu__tick')).toBeNull()
      expect(row('Share').querySelector('.prism-menu__tick')).toBeNull()
    })

    it('shows an icon and a shortcut on a row with a tick too', () => {
      render(
        <Host
          items={[{ type: 'checkbox', label: 'Grid', checked: true, icon: <i data-testid="icon" />, shortcut: 'G' }]}
        />,
      )
      expect(row('Grid').querySelector('.prism-menu__lead')?.contains(screen.getByTestId('icon'))).toBe(true)
      expect(row('Grid').querySelector('.prism-menu__shortcut')?.textContent).toBe('G')
      expect(row('Grid').querySelector('.prism-menu__tick svg')).not.toBeNull()
    })

    it('shows an icon, a shortcut and a chevron', () => {
      render(<Host items={[{ label: 'Save', icon: <i data-testid="icon" />, shortcut: 'Ctrl+S' }, entries[3]]} />)
      expect(row('Save').contains(screen.getByTestId('icon'))).toBe(true)
      expect(row('Save').querySelector('.prism-menu__shortcut')?.textContent).toBe('Ctrl+S')
      expect(row('Save').querySelector('.prism-menu__chevron')).toBeNull()
      expect(row('Share').querySelector('.prism-menu__chevron')).not.toBeNull()
    })

    it('draws separators, and groups under their headings', () => {
      render(
        <Host
          items={[
            { label: 'One' },
            { type: 'separator' },
            { type: 'group', label: 'Theme', items: [{ label: 'Two' }] },
            { type: 'group', items: [{ label: 'Three' }] },
          ]}
        />,
      )
      expect(screen.getByRole('separator')).toBeTruthy()
      expect(screen.getByRole('group', { name: 'Theme' }).contains(row('Two'))).toBe(true)
      expect(row('Three').closest('[role="group"]')?.hasAttribute('aria-labelledby')).toBe(false)
    })

    it('marks a dangerous row', () => {
      render(<Host />)
      expect(row('Delete').classList.contains('prism-menu__item--danger')).toBe(true)
    })

    it('makes a row with an href a link, unless it is disabled', () => {
      render(
        <Host
          items={[
            { label: 'Docs', href: '/docs', target: '_blank' },
            { label: 'Here', href: '/here' },
            { label: 'Gone', href: '/gone', disabled: true },
          ]}
        />,
      )
      expect(row('Docs').tagName).toBe('A')
      expect(row('Docs').getAttribute('href')).toBe('/docs')
      expect(row('Docs').getAttribute('target')).toBe('_blank')
      // A page opened in a new tab gets no hold on this one.
      expect(row('Docs').getAttribute('rel')).toBe('noopener')
      expect(row('Here').hasAttribute('rel')).toBe(false)
      expect(row('Gone').tagName).toBe('DIV')
    })
  })

  describe('choosing', () => {
    it('chooses a row on a press, closes and hands the focus back', () => {
      const onSelect = vi.fn<() => void>()
      renderFromAnchor({ items: [{ label: 'Go', onSelect }] })

      fireEvent.click(row('Go'))
      expect(onSelect).toHaveBeenCalledOnce()
      expect(shows('Go')).toBe(false)
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Anchor' }))
    })

    it.each(['Enter', ' '])('chooses the focused row on %j', (key) => {
      const onSelect = vi.fn<() => void>()
      render(<Host focusOnOpen="first" items={[{ label: 'Go', onSelect }]} />)

      const event = createEvent.keyDown(document.activeElement!, { key })
      fireEvent(document.activeElement!, event)
      expect(onSelect).toHaveBeenCalledOnce()
      expect(event.defaultPrevented).toBe(true)
      expect(shows('Go')).toBe(false)
    })

    it('hands the focus back before onSelect, which may move it on', () => {
      let focusedThen: Element | null = null
      renderFromAnchor({ items: [{ label: 'Go', onSelect: () => (focusedThen = document.activeElement) }] })

      fireEvent.click(row('Go'))
      expect(focusedThen).toBe(screen.getByRole('button', { name: 'Anchor' }))
    })

    it('stays open on a row that asks to', () => {
      const onSelect = vi.fn<() => void>()
      render(<Host items={[{ type: 'checkbox', label: 'Go', checked: false, keepOpen: true, onSelect }]} />)

      fireEvent.click(row('Go'))
      expect(onSelect).toHaveBeenCalledOnce()
      expect(shows('Go')).toBe(true)
    })

    it('does nothing on a disabled row', () => {
      const onSelect = vi.fn<() => void>()
      render(<Host items={[{ label: 'Go', disabled: true, onSelect }]} />)

      fireEvent.click(row('Go'))
      expect(onSelect).not.toHaveBeenCalled()
      expect(shows('Go')).toBe(true)
    })

    it('closes every menu from a row in a submenu', () => {
      const onSelect = vi.fn<() => void>()
      render(<Host items={[{ type: 'submenu', label: 'Share', items: [{ label: 'Email', onSelect }] }]} />)

      fireEvent.click(row('Share'))
      fireEvent.click(row('Email'))
      expect(onSelect).toHaveBeenCalledOnce()
      expect(shows('Email')).toBe(false)
      expect(shows('Share')).toBe(false)
    })
  })

  describe('the keyboard', () => {
    it('opens with the focus on the menu, no row lit', () => {
      render(<Host />)
      expect(document.activeElement).toBe(menuOf('Cut'))
    })

    it.each([
      ['first', 'Cut'],
      ['last', 'Delete'],
    ] as const)('opens with the focus on the %s row', (where, label) => {
      render(<Host focusOnOpen={where} />)
      expect(focused()).toBe(label)
    })

    it('steps over disabled rows and separators, going round at the ends', () => {
      render(<Host focusOnOpen="first" />)

      press('ArrowDown')
      expect(focused()).toBe('Share')
      press('ArrowDown')
      expect(focused()).toBe('Delete')
      press('ArrowDown')
      expect(focused()).toBe('Cut')
      press('ArrowUp')
      expect(focused()).toBe('Delete')
    })

    it('steps through the rows of a group as any others', () => {
      render(
        <Host
          focusOnOpen="first"
          items={[{ label: 'One' }, { type: 'group', label: 'Set', items: [{ label: 'Two' }] }, { label: 'Three' }]}
        />,
      )
      press('ArrowDown')
      expect(focused()).toBe('Two')
      press('ArrowDown')
      expect(focused()).toBe('Three')
    })

    it('starts from the menu itself on either arrow', () => {
      render(<Host />)
      press('ArrowUp')
      expect(focused()).toBe('Delete')
    })

    it('goes to the ends on Home and End', () => {
      render(<Host focusOnOpen="first" />)
      press('End')
      expect(focused()).toBe('Delete')
      press('Home')
      expect(focused()).toBe('Cut')
    })

    it('holds the keys that move the focus back from the page', () => {
      render(<Host focusOnOpen="first" />)
      const event = createEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
      fireEvent(document.activeElement!, event)
      expect(event.defaultPrevented).toBe(true)
    })

    it('moves to the row typed, and passes over those it can’t focus', () => {
      render(<Host focusOnOpen="first" />)
      press('d')
      expect(focused()).toBe('Delete')
    })

    function typeAt(key: string, timeStamp: number) {
      const target = document.activeElement!
      const event = createEvent.keyDown(target, { key })
      Object.defineProperty(event, 'timeStamp', { value: timeStamp })
      fireEvent(target, event)
    }

    it('reads letters typed quickly as a word, and starts again after a pause', () => {
      render(<Host focusOnOpen="first" items={[{ label: 'Cut' }, { label: 'Dot' }, { label: 'Dart' }]} />)

      typeAt('d', 1000)
      expect(focused()).toBe('Dot')
      typeAt('a', 1100)
      expect(focused()).toBe('Dart')
      typeAt('c', 2000)
      expect(focused()).toBe('Cut')
    })

    it('reads Space as part of what is being typed, and otherwise as choosing', () => {
      const onSelect = vi.fn<() => void>()
      render(
        <Host focusOnOpen="first" items={[{ label: 'Cut' }, { label: 'Save as' }, { label: 'Save all', onSelect }]} />,
      )

      for (const [i, letter] of [...'save al'].entries()) typeAt(letter, 1000 + i)
      expect(focused()).toBe('Save all')
      expect(onSelect).not.toHaveBeenCalled()

      typeAt(' ', 2000)
      expect(onSelect).toHaveBeenCalledOnce()
    })

    it('chooses on Space straight after typing, where no label goes on with a space', () => {
      const onSelect = vi.fn<() => void>()
      render(<Host focusOnOpen="first" items={[{ label: 'Lake' }, { label: 'Ocean', onSelect }]} />)

      typeAt('o', 1000)
      expect(focused()).toBe('Ocean')
      typeAt(' ', 1050)
      expect(onSelect).toHaveBeenCalledOnce()
    })

    it('leaves combinations with Ctrl, Cmd or Alt to the page', () => {
      render(<Host focusOnOpen="first" />)
      const event = createEvent.keyDown(document.activeElement!, { key: 'd', ctrlKey: true })
      fireEvent(document.activeElement!, event)
      expect(focused()).toBe('Cut')
      expect(event.defaultPrevented).toBe(false)
    })

    it('ignores keys that are composing text', () => {
      render(<Host focusOnOpen="first" />)
      press('ArrowDown', { isComposing: true })
      expect(focused()).toBe('Cut')
    })

    it('closes on Tab, handing the focus back for it to go on from, and lets the Tab through', () => {
      renderFromAnchor({ focusOnOpen: 'first' })
      const event = createEvent.keyDown(document.activeElement!, { key: 'Tab' })
      fireEvent(document.activeElement!, event)

      expect(event.defaultPrevented).toBe(false)
      expect(shows('Cut')).toBe(false)
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Anchor' }))
    })

    it('hands the focus back on Escape', () => {
      renderFromAnchor({ focusOnOpen: 'first' })
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(shows('Cut')).toBe(false)
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Anchor' }))
    })
  })

  describe('submenus', () => {
    const open = (name: string) => row(name).getAttribute('aria-expanded')

    function toShare() {
      render(<Host focusOnOpen="first" />)
      press('ArrowDown')
    }

    it('marks a row that opens a submenu, and ties it to the submenu', () => {
      render(<Host />)
      expect(row('Share').getAttribute('aria-haspopup')).toBe('menu')
      expect(open('Share')).toBe('false')
      expect(row('Share').getAttribute('aria-controls')).toBe(popupOf('Email').id)
      expect(row('Cut').hasAttribute('aria-haspopup')).toBe(false)
    })

    it('names a submenu after its row', () => {
      render(<Host />)
      expect(menuOf('Email').getAttribute('aria-label')).toBe('Share')
    })

    it('stays mounted while closed, to fade out', () => {
      render(<Host />)
      expect(shows('Email')).toBe(false)
      fireEvent.click(row('Share'))
      expect(shows('Email')).toBe(true)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(shows('Email')).toBe(false)
      expect(screen.queryByText('Email')).not.toBeNull()
    })

    it('is its own popup, sliding as a submenu does', () => {
      render(<Host />)
      expect(popupOf('Email').classList.contains('prism-menu--submenu')).toBe(true)
      expect(popupOf('Cut').classList.contains('prism-menu--submenu')).toBe(false)
    })

    it('lies over the edge of its row, its first row level with it', () => {
      render(<Host />)
      fireEvent.click(row('Share'))
      // The row is 80 wide at x 100: its submenu starts 4 inside its edge, and 4 higher, for the list's padding.
      expect(popupOf('Email').style.left).toBe('176px')
      expect(popupOf('Email').style.top).toBe('96px')
      expect(popupOf('Email').dataset.side).toBe('right')
    })

    it('takes its gap from submenuOffset', () => {
      render(<Host submenuOffset={6} />)
      fireEvent.click(row('Share'))
      expect(popupOf('Email').style.left).toBe('186px')
    })

    it('opens to the left in text running right to left', () => {
      rightToLeft()
      vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue(
        DOMRect.fromRect({ x: 700, y: 100, width: 80, height: 30 }),
      )
      render(<Host />)
      fireEvent.click(row('Share'))
      expect(popupOf('Email').dataset.side).toBe('left')
    })

    it.each(['ArrowRight', 'Enter', ' '])('opens on %j with the focus on its first row', (key) => {
      toShare()
      press(key)
      expect(shows('Email')).toBe(true)
      expect(focused()).toBe('Email')
      expect(open('Share')).toBe('true')
    })

    it('goes three menus deep', () => {
      toShare()
      press('ArrowRight')
      press('ArrowDown')
      press('ArrowRight')
      expect(focused()).toBe('Fax')
      expect(shows('Fax')).toBe(true)
      expect(shows('Email')).toBe(true)
    })

    it('goes back a level on the left arrow, with the focus on its row', () => {
      toShare()
      press('ArrowRight')
      press('ArrowLeft')
      expect(shows('Email')).toBe(false)
      expect(shows('Share')).toBe(true)
      expect(focused()).toBe('Share')
    })

    it('leaves the left arrow alone in the outermost menu', () => {
      toShare()
      press('ArrowLeft')
      expect(shows('Share')).toBe(true)
      expect(focused()).toBe('Share')
    })

    it('swaps the arrows in text running right to left', () => {
      rightToLeft()
      toShare()
      press('ArrowRight')
      expect(shows('Email')).toBe(false)
      press('ArrowLeft')
      expect(focused()).toBe('Email')
      press('ArrowRight')
      expect(focused()).toBe('Share')
    })

    it('goes back one level at a time on Escape, handing the focus back to the row', () => {
      toShare()
      press('ArrowRight')
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(shows('Email')).toBe(false)
      expect(shows('Share')).toBe(true)
      expect(focused()).toBe('Share')

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(shows('Share')).toBe(false)
    })

    it('closes every menu on Tab', () => {
      renderFromAnchor({ focusOnOpen: 'first' })
      press('ArrowDown')
      press('ArrowRight')
      press('Tab')
      expect(shows('Email')).toBe(false)
      expect(shows('Share')).toBe(false)
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Anchor' }))
    })

    it('closes as the arrows move on from its row', () => {
      render(<Host />)
      fireEvent.click(row('Share'))
      row('Share').focus()
      press('ArrowDown')
      expect(shows('Email')).toBe(false)
      expect(focused()).toBe('Delete')
    })

    it('moves the focus into one already open', () => {
      render(<Host />)
      fireEvent.click(row('Share'))
      row('Share').focus()
      press('ArrowRight')
      expect(focused()).toBe('Email')
    })

    it('doesn’t open with nothing in it', () => {
      render(<Host focusOnOpen="first" items={[{ type: 'submenu', label: 'Empty', items: [] }]} />)
      press('ArrowRight')
      press('Enter')
      fireEvent.click(row('Empty'))
      expect(open('Empty')).toBe('false')
      expect(shows('Empty')).toBe(true)
    })

    it('doesn’t open while disabled', () => {
      render(<Host items={[{ type: 'submenu', label: 'Off', disabled: true, items: [{ label: 'In' }] }]} />)
      fireEvent.click(row('Off'))
      hover(row('Off'))
      wait(1000)
      expect(open('Off')).toBe('false')
      expect(screen.queryByText('In')).toBeNull()
    })

    it('is closed again when the menu next opens', () => {
      const anchor = { x: 0, y: 0 }
      const { rerender } = render(<Menu open anchor={anchor} items={entries} />)
      fireEvent.click(row('Share'))
      expect(shows('Email')).toBe(true)

      rerender(<Menu open={false} anchor={anchor} items={entries} />)
      expect(shows('Email')).toBe(false)
      rerender(<Menu open anchor={anchor} items={entries} />)
      expect(shows('Email')).toBe(false)
      expect(open('Share')).toBe('false')
    })

    it('closes on a press on the menu it came from, without closing that', () => {
      render(<Host />)
      fireEvent.click(row('Share'))
      fireEvent.pointerDown(row('Cut'))
      expect(shows('Email')).toBe(false)
      expect(shows('Cut')).toBe(true)
    })

    it('stays open on a press on its own row', () => {
      render(<Host />)
      fireEvent.click(row('Share'))
      fireEvent.pointerDown(row('Share'))
      fireEvent.click(row('Share'))
      expect(shows('Email')).toBe(true)
    })

    it('counts as inside its menu for a press', () => {
      render(<Host />)
      fireEvent.click(row('Share'))
      fireEvent.pointerDown(row('Email'))
      expect(shows('Cut')).toBe(true)
      expect(shows('Email')).toBe(true)
    })

    it('closes with its menu on a press outside', () => {
      render(<Host />)
      fireEvent.click(row('Share'))
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }))
      expect(shows('Cut')).toBe(false)
      expect(shows('Email')).toBe(false)
    })
  })

  describe('the pointer', () => {
    const leave = (el: Element, x: number, y: number, to: Element) =>
      pointerEvent(el, 'pointerout', 'mouse', { clientX: x, clientY: y, relatedTarget: to })
    const moveOver = (el: Element, x: number, y: number) =>
      pointerEvent(el, 'pointermove', 'mouse', { clientX: x, clientY: y })

    it('lights the row it is over, sharing the focus with the keyboard', () => {
      render(<Host />)
      hover(row('Cut'))
      expect(focused()).toBe('Cut')
      press('ArrowDown')
      expect(focused()).toBe('Share')
    })

    it('doesn’t take the focus from a row that has it', () => {
      render(<Host focusOnOpen="first" />)
      const focus = vi.spyOn(row('Cut'), 'focus')
      hover(row('Cut'))
      expect(focus).not.toHaveBeenCalled()
    })

    it('lights nothing over a disabled row, or once off the rows', () => {
      render(<Host />)
      hover(row('Cut'))
      hover(row('Copy'))
      expect(document.activeElement).toBe(menuOf('Cut'))

      hover(row('Cut'))
      leave(row('Cut'), 0, 0, screen.getByRole('separator'))
      expect(document.activeElement).toBe(menuOf('Cut'))
    })

    it('leaves the focus alone leaving a row that doesn’t have it', () => {
      render(<Host />)
      hover(row('Cut'))
      row('Delete').focus()
      leave(row('Cut'), 0, 0, screen.getByRole('separator'))
      expect(focused()).toBe('Delete')
    })

    it('opens a submenu only once it has rested on the row, however it moves there', () => {
      render(<Host />)
      hover(row('Share'))
      wait(100)
      hover(row('Share'))
      wait(49)
      expect(shows('Email')).toBe(false)
      wait(1)
      expect(shows('Email')).toBe(true)
    })

    it('takes that wait from submenuDelay', () => {
      render(<Host submenuDelay={500} />)
      hover(row('Share'))
      wait(499)
      expect(shows('Email')).toBe(false)
      wait(1)
      expect(shows('Email')).toBe(true)
    })

    it('doesn’t open a submenu it only passed over', () => {
      render(<Host />)
      hover(row('Share'))
      wait(50)
      hover(row('Delete'))
      wait(1000)
      expect(shows('Email')).toBe(false)
    })

    it('doesn’t open a submenu once off its row', () => {
      render(<Host />)
      hover(row('Share'))
      leave(row('Share'), 0, 0, screen.getByRole('separator'))
      wait(1000)
      expect(shows('Email')).toBe(false)
    })

    it('opens one at once on a press', () => {
      render(<Host />)
      fireEvent.click(row('Share'))
      expect(shows('Email')).toBe(true)
    })

    it('closes a submenu after the wait on another row, once the pointer has clearly gone there', () => {
      render(<Host />)
      fireEvent.click(row('Share'))
      hover(row('Delete'))
      expect(shows('Email')).toBe(true)
      wait(150)
      expect(shows('Email')).toBe(false)
      expect(focused()).toBe('Delete')
    })

    it('swaps one submenu for another, both having time to fade', () => {
      render(
        <Host
          items={[
            { type: 'submenu', label: 'One', items: [{ label: 'In one' }] },
            { type: 'submenu', label: 'Two', items: [{ label: 'In two' }] },
          ]}
        />,
      )
      fireEvent.click(row('One'))
      hover(row('Two'))
      wait(150)
      expect(shows('In one')).toBe(false)
      expect(shows('In two')).toBe(true)
    })

    it('keeps a submenu for coming back to its row in time', () => {
      render(<Host />)
      fireEvent.click(row('Share'))
      hover(row('Delete'))
      wait(100)
      hover(row('Share'))
      wait(1000)
      expect(shows('Email')).toBe(true)
    })

    it('keeps a submenu the pointer reaches', () => {
      render(<Host />)
      fireEvent.click(row('Share'))
      hover(row('Delete'))
      wait(100)
      leave(row('Delete'), 190, 150, popupOf('Email'))
      wait(1000)
      expect(shows('Email')).toBe(true)
    })

    describe('heading for a submenu', () => {
      // A menu at the viewport's left, its submenu to the right: x 200 to 300, y 100 to 300.
      function headingFor() {
        render(<Host />)
        fireEvent.click(row('Share'))
        vi.spyOn(popupOf('Email'), 'getBoundingClientRect').mockReturnValue(
          DOMRect.fromRect({ x: 200, y: 100, width: 100, height: 200 }),
        )
        hover(row('Share'))
        leave(row('Share'), 150, 150, row('Delete'))
      }

      it('leaves the rows it crosses alone', () => {
        headingFor()
        moveOver(row('Delete'), 180, 150)
        wait(150)
        expect(shows('Email')).toBe(true)
        expect(focused()).toBe('Share')
      })

      it('gives a row its turn if the pointer stops there', () => {
        headingFor()
        moveOver(row('Delete'), 180, 150)
        wait(300)
        expect(focused()).toBe('Delete')
        wait(150)
        expect(shows('Email')).toBe(false)
      })

      it('lets go as soon as the pointer turns away', () => {
        headingFor()
        moveOver(row('Delete'), 100, 150)
        expect(focused()).toBe('Delete')
      })

      it('holds the rows only for so long', () => {
        headingFor()
        wait(300)
        moveOver(row('Delete'), 180, 150)
        expect(focused()).toBe('Delete')
      })

      it('stays out of the way once the submenu is reached', () => {
        headingFor()
        moveOver(row('Delete'), 180, 150)
        leave(row('Delete'), 190, 150, popupOf('Email'))
        wait(1000)
        expect(shows('Email')).toBe(true)
        expect(focused()).toBe('Share')
      })
    })

    it('doesn’t act on touches, which only press', () => {
      render(<Host />)
      hover(row('Share'), 'touch')
      wait(1000)
      expect(shows('Email')).toBe(false)
      expect(focused()).toBeUndefined()
    })

    it('forgets what it was waiting for as the menu closes', () => {
      const anchor = { x: 0, y: 0 }
      const { rerender } = render(<Menu open anchor={anchor} items={entries} />)
      hover(row('Share'))
      rerender(<Menu open={false} anchor={anchor} items={entries} />)
      expect(vi.getTimerCount()).toBe(0)

      rerender(<Menu open anchor={anchor} items={entries} />)
      wait(1000)
      expect(shows('Email')).toBe(false)
    })

    it('leaves no timer behind once removed', () => {
      const { unmount } = render(<Host />)
      hover(row('Share'))
      expect(vi.getTimerCount()).toBe(1)
      unmount()
      expect(vi.getTimerCount()).toBe(0)
    })
  })

  describe('a slider row', () => {
    const slider = () => screen.getByRole<HTMLInputElement>('slider')
    const zoom = (props: Partial<MenuSlider> = {}): MenuEntry[] => [
      { label: 'Cut' },
      { type: 'slider', label: 'Zoom', value: 40, ...props },
      { label: 'Delete' },
    ]

    it('shows its label, and its value through format', () => {
      render(<Host items={zoom({ min: 20, max: 60, step: 10, format: (value) => `${value}%` })} />)
      expect(slider()).toMatchObject({ value: '40', min: '20', max: '60', step: '10' })
      expect(slider().getAttribute('aria-label')).toBe('Zoom')
      expect(slider().getAttribute('aria-valuetext')).toBe('40%')
      expect(screen.getByText('40%')).toBeTruthy()
      expect(slider().style.getPropertyValue('--_prism-menu-slider-at')).toBe('0.5')
    })

    it('says what it moves to, and leaves the menu open', () => {
      const onChange = vi.fn<(value: number) => void>()
      render(<Host items={zoom({ onChange })} />)
      fireEvent.change(slider(), { target: { value: '75' } })
      expect(onChange).toHaveBeenCalledWith(75)
      expect(shows('Cut')).toBe(true)
    })

    it('is reached with the up and down arrows, and left with them too', () => {
      render(<Host items={zoom()} focusOnOpen="first" />)
      press('ArrowDown')
      expect(document.activeElement).toBe(slider())
      expect(press('ArrowDown')).toBe(false)
      expect(focused()).toBe('Delete')
      press('ArrowUp')
      expect(press('ArrowUp')).toBe(false)
      expect(focused()).toBe('Cut')
    })

    it.each(['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'])('keeps %s for itself', (key) => {
      render(<Host items={zoom()} focusOnOpen="first" />)
      press('ArrowDown')
      // Not held back: the browser moves the slider.
      expect(press(key)).toBe(true)
      expect(document.activeElement).toBe(slider())
    })

    it('stays in a submenu as the left arrow moves it', () => {
      const items: MenuEntry[] = [{ type: 'submenu', label: 'View', items: zoom() }]
      render(<Host items={items} focusOnOpen="first" />)
      press('ArrowRight')
      press('ArrowDown')
      press('ArrowLeft')
      expect(document.activeElement).toBe(slider())
    })

    it('is found by typing its label', () => {
      render(<Host items={zoom()} focusOnOpen="first" />)
      press('z')
      expect(document.activeElement).toBe(slider())
    })

    it('leaves the menu open on Enter, and closes it on Tab', () => {
      const onClose = vi.fn<() => void>()
      render(<Host items={zoom()} onClose={onClose} focusOnOpen="first" />)
      press('ArrowDown')
      press('Enter')
      expect(onClose).not.toHaveBeenCalled()
      press('Tab')
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('takes the focus from the pointer, as a row does', () => {
      render(<Host items={zoom()} />)
      hover(slider())
      expect(document.activeElement).toBe(slider())
    })

    it('keeps the focus as a drag leaves its row, and gives it up after', () => {
      render(<Host items={zoom()} />)
      const line = slider().closest<HTMLElement>('.prism-menu__item')!
      hover(slider())
      pointerEvent(line, 'pointerout', 'mouse', { buttons: 1 })
      expect(document.activeElement).toBe(slider())
      pointerEvent(line, 'pointerout')
      expect(document.activeElement).not.toBe(slider())
    })

    it('passes the focus by while disabled', () => {
      render(<Host items={zoom({ disabled: true })} focusOnOpen="first" />)
      expect(slider().disabled).toBe(true)
      expect(slider().getAttribute('aria-disabled')).toBe('true')
      press('ArrowDown')
      expect(focused()).toBe('Delete')
    })
  })

  describe('a right-click on it', () => {
    it('keeps the browser’s menu away, and the menu of what it is inside', () => {
      const onContextMenu = vi.fn<() => void>()
      render(
        <div onContextMenu={onContextMenu}>
          <Host />
        </div>,
      )
      const event = createEvent.contextMenu(row('Cut'))
      fireEvent(row('Cut'), event)
      expect(event.defaultPrevented).toBe(true)
      expect(onContextMenu).not.toHaveBeenCalled()
    })

    it('still calls its own handler', () => {
      const onContextMenu = vi.fn<() => void>()
      render(<Host onContextMenu={onContextMenu} />)
      fireEvent.contextMenu(row('Cut'))
      expect(onContextMenu).toHaveBeenCalledOnce()
    })
  })

  it('takes a Popup’s props on to it', () => {
    render(<Host data-testid="menu" className="mine" side="right" />)
    const popup = screen.getByTestId('menu')
    expect(popup.classList.contains('mine')).toBe(true)
    expect(popup.classList.contains('prism-menu')).toBe(true)
    expect(popup.dataset.side).toBe('right')
  })

  it('opens at a point', () => {
    render(<Menu open anchor={{ x: 300, y: 200 }} items={entries} />)
    expect(popupOf('Cut').style.left).toBe('300px')
    expect(popupOf('Cut').style.top).toBe('200px')
  })

  it('asks to close on a press outside', () => {
    const onClose = vi.fn<() => void>()
    render(<Host onClose={onClose} />)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('MenuButton', () => {
  function Button(props: Partial<Parameters<typeof MenuButton>[0]>) {
    return (
      <MenuButton items={entries} {...props}>
        Actions
      </MenuButton>
    )
  }
  const button = () => screen.getByRole('button', { name: 'Actions' })

  it('says it opens a menu, and whether it has', () => {
    render(<Button />)
    expect(button().getAttribute('aria-haspopup')).toBe('menu')
    expect(button().getAttribute('aria-expanded')).toBe('false')
    expect(button().getAttribute('aria-controls')).toBe(popupOf('Cut').id)

    fireEvent.click(button(), { detail: 1 })
    expect(button().getAttribute('aria-expanded')).toBe('true')
  })

  it('names its menu after itself', () => {
    render(<Button />)
    expect(menuOf('Cut').getAttribute('aria-labelledby')).toBe(button().id)
  })

  it('takes a name for its menu instead', () => {
    render(<Button menuProps={{ 'aria-labelledby': 'mine' }} />)
    expect(menuOf('Cut').getAttribute('aria-labelledby')).toBe('mine')
  })

  it('opens on a press with no row lit, and closes on another', () => {
    render(<Button />)
    fireEvent.click(button(), { detail: 1 })
    expect(shows('Cut')).toBe(true)
    expect(document.activeElement).toBe(menuOf('Cut'))

    fireEvent.pointerDown(button())
    expect(shows('Cut')).toBe(true)
    fireEvent.click(button(), { detail: 1 })
    expect(shows('Cut')).toBe(false)
  })

  it('opens on the first row from the keyboard’s click', () => {
    render(<Button />)
    fireEvent.click(button(), { detail: 0 })
    expect(focused()).toBe('Cut')
  })

  it.each([
    ['ArrowDown', 'Cut'],
    ['ArrowUp', 'Delete'],
  ])('opens on %s, onto the row at that end', (key, label) => {
    render(<Button />)
    const event = createEvent.keyDown(button(), { key })
    fireEvent(button(), event)
    expect(event.defaultPrevented).toBe(true)
    expect(focused()).toBe(label)
  })

  it('takes the focus for itself on a press, as Safari doesn’t, to get it back', () => {
    render(<Button />)
    fireEvent.click(button(), { detail: 1 })
    fireEvent.click(row('Cut'))
    expect(document.activeElement).toBe(button())
  })

  it('hands the focus back on choosing a row', () => {
    render(<Button />)
    button().focus()
    fireEvent.click(button(), { detail: 0 })
    press('Enter')
    expect(shows('Cut')).toBe(false)
    expect(document.activeElement).toBe(button())
  })

  it('calls its own handlers, which can hold it back', () => {
    const holdBack = (event: SyntheticEvent) => event.preventDefault()
    const onClick = vi.fn<typeof holdBack>(holdBack)
    const onKeyDown = vi.fn<typeof holdBack>(holdBack)
    render(<Button onClick={onClick} onKeyDown={onKeyDown} />)

    fireEvent.click(button())
    fireEvent.keyDown(button(), { key: 'ArrowDown' })
    expect(onClick).toHaveBeenCalledOnce()
    expect(onKeyDown).toHaveBeenCalledOnce()
    expect(shows('Cut')).toBe(false)
  })

  it('does nothing while disabled', () => {
    render(<Button disabled />)
    fireEvent.click(button())
    expect(shows('Cut')).toBe(false)
  })

  it('passes its side and align to the menu', () => {
    render(<Button side="right" align="end" />)
    fireEvent.click(button())
    expect(popupOf('Cut').dataset.side).toBe('right')
  })

  it('keeps a given id', () => {
    render(<Button id="mine" />)
    expect(button().id).toBe('mine')
    expect(popupOf('Cut').id).toBe('mine-menu')
  })
})
