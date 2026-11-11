import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState, type CSSProperties } from 'react'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { manualFrames, placeAt, pointer } from '../../../test/dom'
import { fakeBackdrop } from '../../../test/selector'
import { BackdropContext, type Backdrop } from '../backdrop'
import { CardGrid, type CardGridItem } from './CardGrid'
import type { CardGridLayout } from './layout'

const items: CardGridItem[] = [
  { id: 'a', title: 'Alpha', content: 'First' },
  { id: 'b', title: 'Beta', content: 'Second' },
  { id: 'c', title: <em>Gamma</em>, label: 'Gamma', content: 'Third' },
]

// By their labels rather than their roles: a hidden card is inert, so has no accessible name.
function cards() {
  return [...document.querySelectorAll<HTMLElement>('.prism-card-grid__card')]
}

function card(name: string) {
  return cards().find((el) => el.getAttribute('aria-label') === name)!
}

/** The cards' names in the order they are laid out, hidden ones included. */
function order() {
  return cards().map((el) => el.getAttribute('aria-label'))
}

function shown(name: string) {
  const el = card(name)
  return !el.classList.contains('prism-card-grid__card--hidden') && !el.inert
}

function header(name: string) {
  return card(name).querySelector('.prism-card-grid__header')!
}

/**
 * Lays the cards out side by side, 100×50 apiece 10px apart, as jsdom has no
 * layout, in a grid just as wide and 200px tall, as if given a min-height.
 */
function layOut() {
  Object.defineProperties(document.querySelector('.prism-card-grid__cards')!, {
    clientWidth: { configurable: true, value: cards().length * 110 - 10 },
    clientHeight: { configurable: true, value: 200 },
  })
  cards().forEach((el, i) => {
    Object.defineProperties(el, {
      offsetLeft: { configurable: true, value: i * 110 },
      offsetTop: { configurable: true, value: 0 },
      offsetWidth: { configurable: true, value: 100 },
      offsetHeight: { configurable: true, value: 50 },
    })
  })
}

// jsdom works out the cards' transitions from their styles but plays none, so a change
// would wait for a fade that never ends. The cards are given none to wait for, as with
// reduced motion; a test of a fade gives them one (fadeFor).
const still = document.createElement('style')
still.textContent = '.prism-card-grid__card { transition-duration: 0s !important }'

/** Gives each card a fade to wait for, over the page's own say that there is none. */
function fadeFor(duration: string) {
  for (const el of cards()) el.style.setProperty('transition-duration', duration, 'important')
}

beforeEach(() => {
  document.head.append(still)
})

afterEach(() => {
  cleanup()
  still.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('CardGrid', () => {
  it('lays out a card for each item, titled, in the order given', () => {
    render(<CardGrid items={items} />)

    expect(order()).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(card('Alpha').classList.contains('prism-card')).toBe(true)
    expect(card('Beta').textContent).toContain('Second')
    expect(screen.getByRole('button', { name: 'Minimise Gamma' })).toBeTruthy()
  })

  it('starts from defaultLayout, putting cards it leaves out at the end', () => {
    render(<CardGrid items={items} defaultLayout={{ order: ['c', 'a'], minimised: ['a'] }} />)

    expect(order()).toEqual(['Gamma', 'Alpha', 'Beta'])
    expect(shown('Alpha')).toBe(false)
    const tray = screen.getByRole('toolbar', { name: 'Minimised cards' })
    expect([...tray.querySelectorAll('.prism-card-grid__chip')].map((chip) => chip.textContent)).toEqual(['Alpha'])
  })

  it('pads each body as asked', () => {
    render(<CardGrid items={items} padding="lg" />)
    expect(card('Alpha').querySelector('.prism-card-grid__body--pad-lg')).not.toBeNull()
  })

  it('passes other div props to its root', () => {
    render(<CardGrid items={items} id="dash" className="mine" data-testid="grid" />)
    const root = screen.getByTestId('grid')
    expect(root.id).toBe('dash')
    expect([...root.classList]).toEqual(['prism-card-grid', 'mine'])
  })

  it('docks a card in the tray, then brings it back from its chip', async () => {
    const onLayoutChange = vi.fn<(layout: CardGridLayout) => void>()
    // A chip's fade as short as can be, so the test needn't wait it out
    const quick = { '--prism-card-grid-minimise-duration': '0s' } as CSSProperties
    render(<CardGrid items={items} onLayoutChange={onLayoutChange} style={quick} />)

    fireEvent.click(screen.getByRole('button', { name: 'Minimise Beta' }))
    expect(shown('Beta')).toBe(false)
    const chip = screen.getByRole('button', { name: 'Restore Beta' })
    expect(document.activeElement).toBe(chip)
    expect(onLayoutChange).toHaveBeenLastCalledWith({ order: ['a', 'b', 'c'], minimised: ['b'], maximised: null })

    fireEvent.click(chip)
    expect(shown('Beta')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Restore Beta' })).toBeNull()
    expect(document.activeElement).toBe(card('Beta').querySelector('.prism-card-grid__title'))
    expect(onLayoutChange).toHaveBeenLastCalledWith({ order: ['a', 'b', 'c'], minimised: [], maximised: null })

    // The tray goes once its chip has faded out
    await act(() => new Promise((resolve) => setTimeout(resolve, 80)))
    expect(screen.queryByRole('toolbar')).toBeNull()
  })

  it('fades a card back in where it belongs as its chip fades out where it was in the tray', () => {
    // Drawn while shown, as jsdom draws nothing, so the docked one comes back as new
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
      return (this.classList.contains('prism-card-grid__card--hidden') ? [] : [{}]) as unknown as DOMRectList
    })
    render(<CardGrid items={items} defaultLayout={{ minimised: ['a', 'b', 'c'] }} />)
    const grid = document.querySelector<HTMLElement>('.prism-card-grid__cards')!
    const chips = () => [...document.querySelectorAll<HTMLElement>('.prism-card-grid__chip')]

    // How Beta is drawn as each card is drawn where it starts from, just before they transition
    const starts: { opacity: string; translate: string; scale: string }[] = []
    Object.defineProperty(grid, 'offsetWidth', {
      configurable: true,
      get: () => {
        const { opacity, translate, scale } = card('Beta').style
        starts.push({ opacity, translate, scale })
        return 0
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Restore Beta' }))
    expect(grid.getAttribute('data-prism-change')).toBe('undock')
    expect(starts).toContainEqual({ opacity: '0', translate: '', scale: '' })

    // Its chip stays where it was, fading, out of reach
    expect(chips().map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'Restore Alpha',
      'Restore Beta',
      'Restore Gamma',
    ])
    const going = chips()[1]
    expect(going.classList.contains('prism-card-grid__chip--leaving')).toBe(true)
    // jsdom has no inert property, only the attribute
    expect(going.hasAttribute('inert')).toBe(true)
    expect(going.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getAllByRole('button', { name: /^Restore/ }).map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'Restore Alpha',
      'Restore Gamma',
    ])
  })

  it('has a maximised card fill the grid and hides the rest, until pressed again', () => {
    const { container } = render(<CardGrid items={items} />)
    const maximise = screen.getByRole('button', { name: 'Maximise Alpha' })

    fireEvent.click(maximise)
    expect(maximise.getAttribute('aria-pressed')).toBe('true')
    expect(card('Alpha').classList.contains('prism-card-grid__card--maximised')).toBe(true)
    expect(container.querySelector('.prism-card-grid--maximised')).not.toBeNull()
    expect([shown('Alpha'), shown('Beta'), shown('Gamma')]).toEqual([true, false, false])

    fireEvent.click(maximise)
    expect(maximise.getAttribute('aria-pressed')).toBe('false')
    expect([shown('Alpha'), shown('Beta'), shown('Gamma')]).toEqual([true, true, true])
  })

  it('fades the other cards out where they are before one fills the grid, and nothing else moves meanwhile', () => {
    const onLayoutChange = vi.fn<(layout: CardGridLayout) => void>()
    render(<CardGrid items={items} onLayoutChange={onLayoutChange} />)
    fadeFor('0.15s')
    const fading = (name: string) => card(name).hasAttribute('data-prism-fading')

    fireEvent.click(screen.getByRole('button', { name: 'Maximise Alpha' }))
    expect([fading('Alpha'), fading('Beta'), fading('Gamma')]).toEqual([false, true, true])
    expect([shown('Beta'), shown('Gamma')]).toEqual([true, true])
    expect(card('Alpha').classList.contains('prism-card-grid__card--maximised')).toBe(false)
    expect(onLayoutChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Minimise Beta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Maximise Alpha' }))
    expect(onLayoutChange).not.toHaveBeenCalled()

    act(() => {
      card('Beta').dispatchEvent(
        Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: 'opacity' }),
      )
    })
    expect(card('Alpha').classList.contains('prism-card-grid__card--maximised')).toBe(true)
    expect([shown('Beta'), shown('Gamma')]).toEqual([false, false])
    expect([fading('Beta'), fading('Gamma')]).toEqual([false, false])
    expect(onLayoutChange).toHaveBeenCalledExactlyOnceWith({ order: ['a', 'b', 'c'], minimised: [], maximised: 'a' })
  })

  it('puts a maximised card back the same way round: it shrinks, then the others fade in where they are', () => {
    // Drawn while shown, as jsdom draws nothing, so the hidden ones come back as new
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
      return (this.classList.contains('prism-card-grid__card--hidden') ? [] : [{}]) as unknown as DOMRectList
    })
    render(<CardGrid items={items} />)
    const grid = document.querySelector<HTMLElement>('.prism-card-grid__cards')!
    fireEvent.click(screen.getByRole('button', { name: 'Maximise Alpha' }))
    expect(grid.getAttribute('data-prism-change')).toBeNull()

    // How Beta is drawn as each card is drawn where it starts from, just before they transition
    const starts: { opacity: string; scale: string }[] = []
    Object.defineProperty(grid, 'offsetWidth', {
      configurable: true,
      get: () => {
        starts.push({ opacity: card('Beta').style.opacity, scale: card('Beta').style.scale })
        return 0
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Maximise Alpha' }))
    expect(grid.getAttribute('data-prism-change')).toBe('unmaximise')
    expect(starts).toContainEqual({ opacity: '0', scale: '' })
    expect(shown('Beta')).toBe(true)

    // Until the next change, which has its own timing
    fireEvent.click(screen.getByRole('button', { name: 'Minimise Beta' }))
    expect(grid.getAttribute('data-prism-change')).toBeNull()
  })

  it('fades a docked card out where it is, rather than into its chip', () => {
    // Drawn, as jsdom draws nothing, with the chip far from the card
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
    const chipBox = { left: 400, top: 300, width: 80, height: 30, right: 480, bottom: 330, x: 400, y: 300 }
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const box = this.classList.contains('prism-card-grid__chip') ? chipBox : { left: 0, top: 0, width: 0, height: 0 }
      return { right: 0, bottom: 0, x: 0, y: 0, ...box, toJSON: () => box } as DOMRect
    })
    render(<CardGrid items={items} />)

    fireEvent.click(screen.getByRole('button', { name: 'Minimise Beta' }))
    expect(card('Beta').classList.contains('prism-card-grid__card--leaving')).toBe(true)
    expect(card('Beta').style.opacity).toBe('0')
    expect(card('Beta').style.translate).toBe('')
    expect(card('Beta').style.scale).toBe('')
  })

  it('fades a card back in when brought back before it has finished leaving', () => {
    // Drawn, as jsdom draws nothing: Beta stays pinned where it was as it fades
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
    render(<CardGrid items={items} />)

    fireEvent.click(screen.getByRole('button', { name: 'Minimise Beta' }))
    expect(card('Beta').style.opacity).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: 'Restore Beta' }))
    expect(shown('Beta')).toBe(true)
    expect(card('Beta').style.opacity).toBe('')
  })

  it('toggles maximised on a double-click of the header, but not of its buttons', () => {
    render(<CardGrid items={items} />)

    fireEvent.doubleClick(screen.getByRole('button', { name: 'Minimise Beta' }))
    expect(shown('Alpha')).toBe(true)

    fireEvent.doubleClick(header('Beta'))
    expect(shown('Alpha')).toBe(false)
    fireEvent.doubleClick(header('Beta'))
    expect(shown('Alpha')).toBe(true)
  })

  it('toggles maximised on Enter or Space on a title, as its double-click does, but not on a key held down', () => {
    render(<CardGrid items={items} />)
    const title = screen.getByRole('button', { name: 'Beta' })

    expect(fireEvent.keyDown(title, { key: 'Enter' })).toBe(false)
    expect(shown('Alpha')).toBe(false)
    expect(card('Beta').classList.contains('prism-card-grid__card--maximised')).toBe(true)

    // Held, it repeats: taken, so the page doesn't scroll for Space, but once is enough.
    expect(fireEvent.keyDown(title, { key: ' ', repeat: true })).toBe(false)
    expect(shown('Alpha')).toBe(false)

    fireEvent.keyDown(title, { key: ' ' })
    expect(shown('Alpha')).toBe(true)
    expect(card('Beta').classList.contains('prism-card-grid__card--maximised')).toBe(false)
  })

  it('leaves Enter to what is inside a title, a link say', () => {
    const linked = [{ id: 'a', title: <a href="#alpha">Alpha</a>, label: 'Alpha', content: 'A' }, items[1]]
    render(<CardGrid items={linked} />)
    expect(fireEvent.keyDown(screen.getByRole('link', { name: 'Alpha' }), { key: 'Enter' })).toBe(true)
    expect(shown('Beta')).toBe(true)
  })

  it('shows the layout it is given and asks for changes', () => {
    const onLayoutChange = vi.fn<(layout: CardGridLayout) => void>()
    const layout = { order: ['b', 'a', 'c'], minimised: [], maximised: null }
    render(<CardGrid items={items} layout={layout} onLayoutChange={onLayoutChange} />)

    expect(order()).toEqual(['Beta', 'Alpha', 'Gamma'])
    fireEvent.click(screen.getByRole('button', { name: 'Minimise Alpha' }))
    expect(onLayoutChange).toHaveBeenCalledWith({ order: ['b', 'a', 'c'], minimised: ['a'], maximised: null })
    expect(shown('Alpha')).toBe(true)
  })

  it('leaves a card as it was when its parent keeps the layout as it is', () => {
    // Drawn, as jsdom draws nothing, so the card is pinned to fade out
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
    const layout = { order: ['a', 'b', 'c'], minimised: [], maximised: null }
    render(<CardGrid items={items} layout={layout} onLayoutChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Minimise Beta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Maximise Alpha' }))
    for (const name of ['Alpha', 'Beta', 'Gamma']) {
      expect(shown(name)).toBe(true)
      expect(card(name).style.opacity).toBe('')
      expect(card(name).hasAttribute('data-prism-fading')).toBe(false)
      expect(card(name).classList.contains('prism-card-grid__card--leaving')).toBe(false)
    }
  })

  it('fades a card back in when its parent shows it again, as with a reset', () => {
    // Drawn, as jsdom draws nothing, so each one leaving is pinned and faded out
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
    const start: CardGridLayout = { order: ['a', 'b', 'c'], minimised: [], maximised: null }
    function Controlled() {
      const [layout, setLayout] = useState(start)
      return (
        <>
          <CardGrid items={items} layout={layout} onLayoutChange={setLayout} />
          <button type="button" onClick={() => setLayout(start)}>
            Reset
          </button>
        </>
      )
    }
    render(<Controlled />)
    const reset = () => fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    // Docked, and then maximised, the grid's own way: each leaving card is left faded out
    fireEvent.click(screen.getByRole('button', { name: 'Minimise Beta' }))
    expect(card('Beta').style.opacity).toBe('0')
    reset()
    expect(shown('Beta')).toBe(true)
    expect(card('Beta').style.opacity).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Maximise Alpha' }))
    expect(card('Gamma').style.opacity).toBe('0')
    reset()
    for (const name of ['Alpha', 'Beta', 'Gamma']) {
      expect(shown(name)).toBe(true)
      expect(card(name).style.opacity).toBe('')
    }
  })

  it('fixes how many columns and rows there are, as whole numbers of at least 1', () => {
    const { rerender } = render(<CardGrid items={items} columns={3} rows={2} data-testid="grid" />)
    const root = screen.getByTestId('grid')
    expect(root.classList.contains('prism-card-grid--columns')).toBe(true)
    expect(root.classList.contains('prism-card-grid--rows')).toBe(true)
    expect(root.style.getPropertyValue('--prism-card-grid-columns')).toBe('3')
    expect(root.style.getPropertyValue('--prism-card-grid-rows')).toBe('2')

    rerender(<CardGrid items={items} columns={2.7} rows={0} data-testid="grid" style={{ color: 'red' }} />)
    expect(root.style.getPropertyValue('--prism-card-grid-columns')).toBe('2')
    expect(root.classList.contains('prism-card-grid--rows')).toBe(false)
    expect(root.style.getPropertyValue('--prism-card-grid-rows')).toBe('')
    expect(root.style.color).toBe('red')

    rerender(<CardGrid items={items} data-testid="grid" />)
    expect(root.classList.contains('prism-card-grid--columns')).toBe(false)
  })

  it('moves a card a row with the up and down keys, by its columns', () => {
    render(<CardGrid items={items} columns={2} />)
    const title = card('Alpha').querySelector<HTMLElement>('.prism-card-grid__title')!
    title.focus()

    fireEvent.keyDown(title, { key: 'ArrowDown' })
    expect(order()).toEqual(['Beta', 'Gamma', 'Alpha'])
    fireEvent.keyDown(title, { key: 'ArrowDown' })
    expect(order()).toEqual(['Beta', 'Gamma', 'Alpha'])
    fireEvent.keyDown(title, { key: 'ArrowUp' })
    expect(order()).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('moves a card along the text with the left and right keys, right to left too', () => {
    render(<CardGrid items={items} />)
    document.querySelector<HTMLElement>('.prism-card-grid__cards')!.style.direction = 'rtl'
    const title = card('Beta').querySelector<HTMLElement>('.prism-card-grid__title')!

    fireEvent.keyDown(title, { key: 'ArrowRight' })
    expect(order()).toEqual(['Beta', 'Alpha', 'Gamma'])
    fireEvent.keyDown(title, { key: 'ArrowLeft' })
    expect(order()).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('says where the arrow keys moved a card, among the cards shown', () => {
    render(<CardGrid items={items} defaultLayout={{ minimised: ['b'] }} />)
    const title = screen.getByRole('button', { name: 'Alpha' })
    expect(title.getAttribute('aria-roledescription')).toBe('movable card title')

    fireEvent.keyDown(title, { key: 'ArrowRight' })
    expect(screen.getByRole('status').textContent).toBe('Alpha moved to place 2 of 2')
  })

  it('takes its accessible names from its labels', () => {
    render(
      <CardGrid
        items={items}
        defaultLayout={{ minimised: ['b'] }}
        minimiseLabel={(title) => `Réduire ${title}`}
        maximiseLabel={(title) => `Agrandir ${title}`}
        restoreLabel={(title) => `Rétablir ${title}`}
        movedLabel={(title, place, places) => `${title} : ${place}/${places}`}
      />,
    )
    expect(screen.getByRole('button', { name: 'Réduire Alpha' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agrandir Alpha' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rétablir Beta' })).toBeTruthy()

    fireEvent.keyDown(screen.getByRole('button', { name: 'Alpha' }), { key: 'ArrowRight' })
    expect(screen.getByRole('status').textContent).toBe('Alpha : 2/2')
  })

  it('moves a card with the arrow keys on its title, keeping it focused', () => {
    render(<CardGrid items={items} />)
    const title = card('Alpha').querySelector<HTMLElement>('.prism-card-grid__title')!
    title.focus()

    fireEvent.keyDown(title, { key: 'ArrowRight' })
    expect(order()).toEqual(['Beta', 'Alpha', 'Gamma'])
    expect(document.activeElement).toBe(title)

    fireEvent.keyDown(title, { key: 'ArrowLeft' })
    fireEvent.keyDown(title, { key: 'ArrowLeft' })
    expect(order()).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  describe('tray', () => {
    const tray = () => document.querySelector<HTMLElement>('.prism-card-grid__tray')!
    const chip = (name: string) => screen.getByRole('button', { name: `Restore ${name}` })

    it("is a horizontal selector's track, its glass drawn by a backdrop as that track's is", () => {
      const { backdrop } = fakeBackdrop()
      render(
        <BackdropContext value={backdrop}>
          <CardGrid items={items} />
        </BackdropContext>,
      )
      // The capsule is the tray itself: the selector's sheet draws its tint, rim, glints and shadow
      expect(tray().classList.contains('prism-horizontal-selector')).toBe(true)
      expect(backdrop.track).toHaveBeenCalledWith(tray())
    })

    it('sits above the grid, a track of selector entries, there with a placeholder while empty', () => {
      render(<CardGrid items={items} />)
      const placeholder = () => tray().querySelector('.prism-card-grid__tray-placeholder')
      expect(tray().nextElementSibling!.classList.contains('prism-card-grid__cards')).toBe(true)
      // The chips scroll in the tray's one child, inside its capsule, which is no selector of its own
      expect([...tray().children].map((el) => el.className)).toEqual(['prism-card-grid__tray-track'])
      expect(tray().className).toBe('prism-horizontal-selector prism-card-grid__tray prism-card-grid__tray--empty')
      // Empty: there, saying what it is for, but out of reach of assistive tech, as a toolbar with nothing in it
      expect(tray().classList.contains('prism-card-grid__tray--empty')).toBe(true)
      expect(placeholder()!.textContent).toBe('Minimised cards appear here')
      expect(screen.queryByRole('toolbar')).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'Minimise Beta' }))
      expect(tray().classList.contains('prism-card-grid__tray--empty')).toBe(false)
      expect(screen.getByRole('toolbar', { name: 'Minimised cards' })).toBe(tray())
      expect(chip('Beta').classList.contains('prism-horizontal-selector__option')).toBe(true)
    })

    it('lists the docked cards in their order in the grid, not the order they were docked', () => {
      render(<CardGrid items={items} />)
      const listed = () =>
        screen.getAllByRole('button', { name: /^Restore/ }).map((el) => el.getAttribute('aria-label'))

      fireEvent.click(screen.getByRole('button', { name: 'Minimise Gamma' }))
      fireEvent.click(screen.getByRole('button', { name: 'Minimise Alpha' }))
      expect(listed()).toEqual(['Restore Alpha', 'Restore Gamma'])
      fireEvent.click(screen.getByRole('button', { name: 'Minimise Beta' }))
      expect(listed()).toEqual(['Restore Alpha', 'Restore Beta', 'Restore Gamma'])
    })

    it('takes a placeholder of its own, or none', () => {
      const { rerender } = render(<CardGrid items={items} trayPlaceholder="Docked cards go here" />)
      expect(tray().querySelector('.prism-card-grid__tray-placeholder')!.textContent).toBe('Docked cards go here')
      rerender(<CardGrid items={items} trayPlaceholder="" />)
      expect(tray().querySelector('.prism-card-grid__tray-placeholder')).toBeNull()
    })

    it('is one tab stop, the arrow keys, Home and End moving focus along it', () => {
      render(<CardGrid items={items} defaultLayout={{ minimised: ['a', 'b', 'c'] }} />)
      const stops = () => ['Alpha', 'Beta', 'Gamma'].filter((name) => chip(name).tabIndex === 0)
      expect(stops()).toEqual(['Alpha'])

      act(() => chip('Alpha').focus())
      fireEvent.keyDown(chip('Alpha'), { key: 'ArrowRight' })
      expect(document.activeElement).toBe(chip('Beta'))
      expect(stops()).toEqual(['Beta'])
      fireEvent.keyDown(chip('Beta'), { key: 'End' })
      expect(document.activeElement).toBe(chip('Gamma'))
      fireEvent.keyDown(chip('Gamma'), { key: 'ArrowRight' })
      expect(document.activeElement).toBe(chip('Gamma'))
      fireEvent.keyDown(chip('Gamma'), { key: 'Home' })
      expect(document.activeElement).toBe(chip('Alpha'))
      // Moving focus brings nothing back: only pressing a chip does
      expect(['Alpha', 'Beta', 'Gamma'].map(shown)).toEqual([false, false, false])
    })

    it("has a selector's hover pill follow the pointer from chip to chip, with nothing marking a selection", () => {
      render(<CardGrid items={items} defaultLayout={{ minimised: ['a', 'b'] }} />)
      // The one indicator: the hover pill as a selector draws it, with its press, and no groove or bead of the tray's own
      const pills = () => [...tray().querySelectorAll('.prism-horizontal-selector__indicator')]
      expect(pills()).toHaveLength(1)
      const pill = pills()[0]
      expect(pill.className).toBe(
        'prism-horizontal-selector__indicator prism-horizontal-selector__indicator--hover prism-press',
      )
      expect(pill.querySelector('.prism-press__tint')).not.toBeNull()

      fireEvent.pointerMove(chip('Beta'))
      expect(pill.classList.contains('prism-horizontal-selector__indicator--shown')).toBe(true)
      expect(chip('Beta').classList.contains('prism-horizontal-selector__option--hovered')).toBe(true)

      fireEvent.pointerLeave(tray())
      expect(pill.classList.contains('prism-horizontal-selector__indicator--shown')).toBe(false)
    })

    it('puts the pill out as the pointer moves off the chips onto the bare track, and sinks it with a chip pressed', () => {
      render(<CardGrid items={items} defaultLayout={{ minimised: ['a', 'b'] }} />)
      const pill = tray().querySelector('.prism-horizontal-selector__indicator')!
      const track = tray().querySelector<HTMLElement>('.prism-card-grid__tray-track')!

      fireEvent.pointerMove(chip('Beta'))
      expect(pill.classList.contains('prism-horizontal-selector__indicator--shown')).toBe(true)
      expect(pill.classList.contains('prism-press--pressed')).toBe(false)

      // Still in the tray, but past the chips
      fireEvent.pointerMove(track)
      expect(pill.classList.contains('prism-horizontal-selector__indicator--shown')).toBe(false)
      expect(chip('Beta').classList.contains('prism-horizontal-selector__option--hovered')).toBe(false)

      // Held, the pill stays under the chip pressed, sunk with it, wherever the pointer goes
      fireEvent.pointerMove(chip('Alpha'))
      fireEvent.pointerDown(chip('Alpha'), { button: 0 })
      expect(pill.classList.contains('prism-press--pressed')).toBe(true)
      fireEvent.pointerMove(track)
      expect(chip('Alpha').classList.contains('prism-horizontal-selector__option--hovered')).toBe(true)
      expect(pill.classList.contains('prism-horizontal-selector__indicator--shown')).toBe(true)
    })

    it('closes a chip up from how wide it was as its card is brought back', () => {
      render(<CardGrid items={items} defaultLayout={{ minimised: ['a', 'b'] }} />)
      Object.defineProperty(chip('Alpha'), 'offsetWidth', { configurable: true, value: 84 })
      const going = chip('Alpha')

      fireEvent.click(going)
      expect(going.classList.contains('prism-card-grid__chip--leaving')).toBe(true)
      expect(going.style.getPropertyValue('--prism-card-grid-chip-width')).toBe('84px')
      // Still docked, Beta's chip is the tray's tab stop now
      expect(chip('Beta').tabIndex).toBe(0)
    })
  })

  describe('dragging', () => {
    let frames: ReturnType<typeof manualFrames>

    beforeEach(() => {
      frames = manualFrames()
    })

    /** Moves the pointer, and lets the frame its move waits for come. */
    function move(x: number, y: number) {
      act(() => {
        pointer(window, 'pointermove', x, y)
        frames.flush()
      })
    }

    it('follows the pointer once a frame, wherever it last was', () => {
      render(<CardGrid items={items} />)
      layOut()

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(30, 10)
      expect(card('Alpha').style.translate).toBe('10px')

      act(() => {
        pointer(window, 'pointermove', 32, 11)
        pointer(window, 'pointermove', 35, 12)
      })
      expect(card('Alpha').style.translate).toBe('10px')
      act(() => frames.flush())
      expect(card('Alpha').style.translate).toBe('15px 2px')
      act(() => pointer(window, 'pointerup', 35, 12))
    })

    it('lets the card go for good when let go before its last frame came', () => {
      render(<CardGrid items={items} />)
      layOut()

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(30, 10)
      act(() => {
        pointer(window, 'pointermove', 60, 30)
        pointer(window, 'pointerup', 60, 30)
      })
      // The frame the last move asked for comes after all: it must do nothing
      act(() => frames.settle())
      expect(card('Alpha').style.translate).toBe('')
      expect(card('Alpha').classList.contains('prism-card-grid__card--dragging')).toBe(false)
      expect(document.querySelector('.prism-card-grid--dragging')).toBeNull()
    })

    it('springs the dropped card the most, and the others less the further they are', () => {
      const springs = new Map<string, { amplitude: number; delay: number }>()
      // jsdom has no Web Animations API to spy on, so it is given one for the test
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        configurable: true,
        value: function (this: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
          const moves = (keyframes as Keyframe[]).map((k) => {
            const [x, y] = String(k.transform).slice('translate('.length).split(',').map(parseFloat)
            return Math.hypot(x, y)
          })
          springs.set(this.getAttribute('aria-label')!, {
            amplitude: Math.max(...moves),
            delay: (options as KeyframeAnimationOptions).delay!,
          })
          return {} as Animation
        },
      })
      onTestFinished(() => {
        delete (HTMLElement.prototype as Partial<HTMLElement>).animate
      })
      render(
        <CardGrid
          items={[...items, { id: 'd', title: 'Delta', content: 'Fourth' }]}
          style={
            {
              '--prism-card-grid-spring': '6px',
              '--prism-card-grid-spring-duration': '700ms',
              '--prism-card-grid-duration': '350ms',
            } as CSSProperties
          }
        />,
      )
      layOut()

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(60, 30)
      act(() => pointer(window, 'pointerup', 60, 30))

      const [alpha, beta, gamma, delta] = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((name) => springs.get(name)!)
      expect(alpha.amplitude).toBeGreaterThan(5)
      expect(beta.amplitude).toBeLessThan(alpha.amplitude)
      expect(gamma.amplitude).toBeLessThan(beta.amplitude)
      expect(delta.amplitude).toBeLessThan(gamma.amplitude)
      // The ripple spreads out: the further, the later
      expect(beta.delay).toBeGreaterThan(alpha.delay)
      expect(delta.delay).toBeGreaterThan(gamma.delay)
    })

    it('takes a last move its frame has not come for yet into account when let go', () => {
      const onLayoutChange = vi.fn<(layout: CardGridLayout) => void>()
      render(<CardGrid items={items} onLayoutChange={onLayoutChange} />)
      layOut()

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(30, 10)
      act(() => {
        pointer(window, 'pointermove', 140, 20)
        pointer(window, 'pointerup', 140, 20)
      })
      expect(onLayoutChange).toHaveBeenCalledExactlyOnceWith({ order: ['b', 'a', 'c'], minimised: [], maximised: null })
    })

    it('moves a card to the place of another it is dragged over, and keeps it there when let go', () => {
      const onLayoutChange = vi.fn<(layout: CardGridLayout) => void>()
      render(<CardGrid items={items} onLayoutChange={onLayoutChange} />)
      layOut()

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(30, 10)
      expect(card('Alpha').classList.contains('prism-card-grid__card--dragging')).toBe(true)
      expect(document.querySelector('.prism-card-grid--dragging')).not.toBeNull()
      expect(card('Alpha').style.translate).toBe('10px')
      // Its streaks ride along with it, where they were lined up at rest
      expect(card('Alpha').querySelector<HTMLElement>('.prism-card__streaks')!.style.backgroundPosition).toBe(
        '-5000px -5000px',
      )

      move(140, 20)
      expect(order()).toEqual(['Beta', 'Alpha', 'Gamma'])
      expect(onLayoutChange).not.toHaveBeenCalled()

      act(() => pointer(window, 'pointerup', 140, 20))
      expect(card('Alpha').classList.contains('prism-card-grid__card--dragging')).toBe(false)
      expect(document.querySelector('.prism-card-grid--dragging')).toBeNull()
      expect(onLayoutChange).toHaveBeenCalledExactlyOnceWith({ order: ['b', 'a', 'c'], minimised: [], maximised: null })
    })

    it('shades and blurs a card under it, edges and all, by how much it covers and puts its lights out, until let go', () => {
      render(<CardGrid items={items} style={{ '--prism-card-grid-under-blur': '6px' } as CSSProperties} />)
      layOut()
      // The whole card, edges and all, with nothing blurred twice inside it
      const blur = (name: string) => {
        const inner = card(name).querySelectorAll<HTMLElement>('.prism-card-grid__header, .prism-card-grid__body')
        expect([...inner].map((el) => el.style.filter)).toEqual(['', ''])
        return card(name).style.filter
      }
      const covered = (name: string) => card(name).style.getPropertyValue('--prism-card-grid-covered')

      // Taken hold of at its top left, then moved halfway over Beta: not far enough for the pointer to pass it
      act(() => pointer(header('Alpha'), 'pointerdown', 0, 0))
      move(55, 0)
      expect(order()).toEqual(['Alpha', 'Beta', 'Gamma'])
      expect(blur('Beta')).toBe('blur(3px)')
      expect(covered('Beta')).toBe('0.45')
      expect(card('Beta').hasAttribute('data-prism-covered')).toBe(true)
      expect(card('Beta').style.getPropertyValue('--prism-refraction')).toBe('0%')
      expect(blur('Gamma')).toBe('')
      expect(covered('Gamma')).toBe('')
      expect(card('Gamma').hasAttribute('data-prism-covered')).toBe(false)
      expect(card('Gamma').style.getPropertyValue('--prism-refraction')).toBe('')

      move(5, 0)
      expect(blur('Beta')).toBe('')
      expect(covered('Beta')).toBe('')
      expect(card('Beta').hasAttribute('data-prism-covered')).toBe(false)
      expect(card('Beta').style.getPropertyValue('--prism-refraction')).toBe('')

      move(60, 0)
      expect(card('Beta').style.getPropertyValue('--prism-refraction')).toBe('0%')
      act(() => pointer(window, 'pointerup', 60, 0))
      expect(blur('Beta')).toBe('')
      expect(covered('Beta')).toBe('')
      expect(card('Beta').hasAttribute('data-prism-covered')).toBe(false)
      expect(card('Beta').style.getPropertyValue('--prism-refraction')).toBe('')
    })

    it('has a backdrop follow the dragged card rather than redraw everything on each move', () => {
      const stopMoving = vi.fn<() => void>()
      const backdrop = {
        track: vi.fn<Backdrop['track']>(() => () => {}),
        invalidate: vi.fn<Backdrop['invalidate']>(),
        moving: vi.fn<Backdrop['moving']>(() => stopMoving),
      }
      render(
        <BackdropContext value={backdrop}>
          <CardGrid items={items} />
        </BackdropContext>,
      )
      layOut()

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(30, 10)
      expect(backdrop.moving).toHaveBeenCalledExactlyOnceWith(card('Alpha'), { lifted: true })
      const invalidated = backdrop.invalidate.mock.calls.length
      // Short of the next card, so nothing comes under it and nothing re-renders
      move(25, 12)
      move(28, 14)
      expect(backdrop.invalidate.mock.calls.length).toBe(invalidated)

      act(() => pointer(window, 'pointerup', 28, 14))
      expect(stopMoving).toHaveBeenCalledOnce()
    })

    it('lets a card dropped where it started transition again', () => {
      vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
      render(<CardGrid items={items} />)
      layOut()
      placeAt(card('Alpha'), 0, 0, 100, 50)

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      // Up and to the left, which the grid's edges hold it from going
      move(10, 0)
      expect(card('Alpha').style.transition).toBe('none')

      act(() => pointer(window, 'pointerup', 10, 0))
      expect(card('Alpha').style.transition).toBe('')
      expect(card('Alpha').style.translate).toBe('')
    })

    it('stops listening to a press if it is unmounted before the press becomes a drag', () => {
      const onError = vi.fn<(event: ErrorEvent) => void>((event) => event.preventDefault())
      window.addEventListener('error', onError)
      onTestFinished(() => window.removeEventListener('error', onError))
      const { unmount } = render(<CardGrid items={items} />)
      layOut()

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      unmount()
      pointer(window, 'pointermove', 60, 40)
      expect(onError).not.toHaveBeenCalled()
    })

    it('leaves a second pointer alone while another is pressing', () => {
      render(<CardGrid items={items} />)
      layOut()

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10, { pointerId: 1 }))
      act(() => pointer(header('Beta'), 'pointerdown', 130, 10, { pointerId: 2 }))
      act(() => {
        pointer(window, 'pointermove', 160, 10, { pointerId: 2 })
        frames.flush()
      })
      expect(card('Beta').classList.contains('prism-card-grid__card--dragging')).toBe(false)

      // And a press can follow once it is let go
      act(() => pointer(window, 'pointerup', 20, 10, { pointerId: 1 }))
      act(() => pointer(header('Beta'), 'pointerdown', 130, 10, { pointerId: 2 }))
      act(() => {
        pointer(window, 'pointermove', 160, 10, { pointerId: 2 })
        frames.flush()
      })
      expect(card('Beta').classList.contains('prism-card-grid__card--dragging')).toBe(true)
      act(() => pointer(window, 'pointerup', 160, 10, { pointerId: 2 }))
    })

    it('puts everything back on Escape', () => {
      const onLayoutChange = vi.fn<(layout: CardGridLayout) => void>()
      render(<CardGrid items={items} onLayoutChange={onLayoutChange} />)
      layOut()

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(250, 20)
      expect(order()).toEqual(['Beta', 'Gamma', 'Alpha'])

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      })
      expect(order()).toEqual(['Alpha', 'Beta', 'Gamma'])
      act(() => pointer(window, 'pointerup', 250, 20))
      expect(onLayoutChange).not.toHaveBeenCalled()
    })

    it('does not drag until the pointer has moved a few px, nor change anything for a click', () => {
      const onLayoutChange = vi.fn<(layout: CardGridLayout) => void>()
      render(<CardGrid items={items} onLayoutChange={onLayoutChange} />)
      layOut()

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(22, 11)
      expect(card('Alpha').classList.contains('prism-card-grid__card--dragging')).toBe(false)
      act(() => pointer(window, 'pointerup', 22, 11))
      expect(onLayoutChange).not.toHaveBeenCalled()
    })

    it('takes in items that come or go mid-drag', () => {
      const onLayoutChange = vi.fn<(layout: CardGridLayout) => void>()
      const { rerender } = render(<CardGrid items={items} onLayoutChange={onLayoutChange} />)
      layOut()

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(140, 20)
      expect(order()).toEqual(['Beta', 'Alpha', 'Gamma'])

      const delta = { id: 'd', title: 'Delta', content: 'Fourth' }
      rerender(<CardGrid items={[items[0], items[1], delta]} onLayoutChange={onLayoutChange} />)
      expect(order()).toEqual(['Beta', 'Alpha', 'Delta'])

      act(() => pointer(window, 'pointerup', 140, 20))
      expect(onLayoutChange).toHaveBeenCalledExactlyOnceWith({ order: ['b', 'a', 'd'], minimised: [], maximised: null })
    })

    it('is dragged by the pointer that took hold of it alone', () => {
      const onLayoutChange = vi.fn<(layout: CardGridLayout) => void>()
      render(<CardGrid items={items} onLayoutChange={onLayoutChange} />)
      layOut()
      const dragging = () => card('Alpha').classList.contains('prism-card-grid__card--dragging')

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10, { pointerId: 1 }))
      act(() => {
        pointer(window, 'pointermove', 140, 20, { pointerId: 2 })
        frames.flush()
      })
      expect(dragging()).toBe(false)

      act(() => {
        pointer(window, 'pointermove', 140, 20, { pointerId: 1 })
        frames.flush()
      })
      expect(order()).toEqual(['Beta', 'Alpha', 'Gamma'])
      act(() => pointer(window, 'pointerup', 140, 20, { pointerId: 2 }))
      expect(dragging()).toBe(true)

      act(() => pointer(window, 'pointerup', 140, 20, { pointerId: 1 }))
      expect(dragging()).toBe(false)
      expect(onLayoutChange).toHaveBeenCalledOnce()
    })

    it('lets go once the mouse button is found up, should its pointerup go unheard', () => {
      const onLayoutChange = vi.fn<(layout: CardGridLayout) => void>()
      render(<CardGrid items={items} onLayoutChange={onLayoutChange} />)
      layOut()
      const mouse = { pointerType: 'mouse', buttons: 1 }

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10, mouse))
      act(() => {
        pointer(window, 'pointermove', 140, 20, mouse)
        frames.flush()
      })
      expect(card('Alpha').classList.contains('prism-card-grid__card--dragging')).toBe(true)

      act(() => pointer(window, 'pointermove', 150, 20, { ...mouse, buttons: 0 }))
      expect(card('Alpha').classList.contains('prism-card-grid__card--dragging')).toBe(false)
      expect(onLayoutChange).toHaveBeenCalledExactlyOnceWith({ order: ['b', 'a', 'c'], minimised: [], maximised: null })
    })

    it('stays under a still pointer as the page scrolls', () => {
      render(<CardGrid items={items} />)
      layOut()
      const grid = document.querySelector('.prism-card-grid__cards')!

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(30, 10)
      expect(card('Alpha').style.translate).toBe('10px')

      placeAt(grid, 0, -15, 0, 0)
      act(() => {
        window.dispatchEvent(new Event('scroll'))
        frames.flush()
      })
      expect(card('Alpha').style.translate).toBe('10px 15px')
      act(() => pointer(window, 'pointerup', 30, 10))
    })

    it('keeps the card inside the grid however far the pointer goes, passing cards by where it is held', () => {
      render(<CardGrid items={items} />)
      layOut()

      // Taken hold of 20px in from its left
      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(-300, -300)
      expect(card('Alpha').style.translate).toBe('0px')

      // Far past the grid's right: at its edge (320 - 100), held over Gamma
      move(1000, 10)
      expect(card('Alpha').style.translate).toBe('220px')
      expect(order()).toEqual(['Beta', 'Gamma', 'Alpha'])

      // And past its bottom: at its edge (200 - 50)
      move(1000, 1000)
      expect(card('Alpha').style.translate).toBe('220px 150px')
      act(() => pointer(window, 'pointerup', 1000, 1000))
    })

    it('follows the pointer in the grid’s own px inside a scaled ancestor', () => {
      render(<CardGrid items={items} />)
      layOut()
      const grid = document.querySelector<HTMLElement>('.prism-card-grid__cards')!
      // Drawn twice its laid-out size
      Object.defineProperties(grid, {
        offsetWidth: { configurable: true, value: 400 },
        offsetHeight: { configurable: true, value: 100 },
      })
      placeAt(grid, 0, 0, 800, 200)

      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(40, 30)
      expect(card('Alpha').style.translate).toBe('10px 10px')
      act(() => pointer(window, 'pointerup', 40, 30))
    })

    it('starts from neither the header buttons nor a maximised card', () => {
      render(<CardGrid items={items} />)
      layOut()

      act(() => pointer(screen.getByRole('button', { name: 'Minimise Alpha' }), 'pointerdown', 20, 10))
      move(140, 20)
      expect(order()).toEqual(['Alpha', 'Beta', 'Gamma'])
      act(() => pointer(window, 'pointerup', 140, 20))

      fireEvent.click(screen.getByRole('button', { name: 'Maximise Alpha' }))
      act(() => pointer(header('Alpha'), 'pointerdown', 20, 10))
      move(140, 20)
      expect(card('Alpha').classList.contains('prism-card-grid__card--dragging')).toBe(false)
    })
  })
})
