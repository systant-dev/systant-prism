import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes } from '../../../test/dom'
import type { ReadablePage } from '../../contrast'
import { Button } from '../button'
import { Card } from '../card'
import { CardGrid } from '../cardGrid'
import { Popup } from '../popup'
import { HorizontalSelector, VerticalSelector } from '../selector'
import { Textarea } from '../textarea'
import { Textbox } from '../textbox'
import { BackdropPaletteContext } from './BackdropContext'
import { glassTextColor } from './useGlassText'

beforeEach(() => {
  manualResizes()
  // jsdom has no popovers.
  HTMLElement.prototype.showPopover = () => {}
  HTMLElement.prototype.hidePopover = () => {}
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

const FG = { property: '--fg' }
const PAGE = '#eceef2'

/** A pane of glass: `tint` over whatever is behind, with its own text colour in `--fg`. */
function pane(tint: string, fg = '#111318', parent: HTMLElement = document.body) {
  const el = document.createElement('div')
  el.style.backgroundColor = tint
  el.style.setProperty('--fg', fg)
  parent.append(el)
  return el
}

describe('glassTextColor', () => {
  const glass = 'rgba(243, 244, 246, 0.3)'

  it("gives glass the page's colour, whatever its tint", () => {
    expect(glassTextColor(pane(glass), FG, PAGE)).toBe(PAGE)
    expect(glassTextColor(pane('rgba(17, 19, 24, 0.6)'), FG, PAGE)).toBe(PAGE)
    expect(glassTextColor(pane('transparent'), FG, PAGE)).toBe(PAGE)
  })

  it('leaves the colour be when the page has none', () => {
    expect(glassTextColor(pane(glass), FG, null)).toBeNull()
  })

  it('stops at the GlassBackdrop, whose canvas covers its background', () => {
    const backdrop = pane('rgb(0, 0, 0)')
    backdrop.className = 'prism-backdrop'
    expect(glassTextColor(pane(glass, '#111318', backdrop), FG, PAGE)).toBe(PAGE)
  })

  it("judges anything opaque for itself, as the page's colours say nothing of it", () => {
    const dark = pane('rgb(0, 0, 0)')
    const color = glassTextColor(pane(glass, '#111318', dark), FG, PAGE)
    expect(color).not.toBeNull()
    expect(color).not.toBe(PAGE)
    expect(glassTextColor(pane('rgb(255, 255, 255)'), FG, PAGE)).toBeNull()
  })

  it('leaves a colour it cannot read', () => {
    expect(glassTextColor(pane('rgb(0, 0, 0)', 'color-mix(in srgb, red, blue)'), FG, null)).toBeNull()
  })

  it('takes the colour it inherits where its own is unset', () => {
    const parent = document.createElement('div')
    parent.style.color = 'rgb(255, 255, 255)'
    document.body.append(parent)
    expect(glassTextColor(pane('rgb(0, 0, 0)', '', parent), FG, null)).toBeNull()
    expect(glassTextColor(pane('rgb(255, 255, 255)', '', parent), FG, null)).not.toBeNull()
  })

  it('judges dimmed text as it shows', () => {
    // #111318 on white reads at full strength, but not at a fifth of it.
    const el = pane('rgb(255, 255, 255)')
    el.style.setProperty('--dim', '0.2')
    expect(glassTextColor(el, FG, null)).toBeNull()
    expect(glassTextColor(el, { ...FG, opacityProperty: '--dim' }, null)).not.toBeNull()
  })
})

function palette(foreground: string): ReadablePage {
  return {
    foreground,
    background: '#24272e',
    glassOpacity: 0.3,
    dimmest: 0,
    selection: {
      background: '#794d2a',
      color: '#eceef2',
      ratio: 7,
      target: 4.5,
      separation: 3,
      separationTarget: 3,
      passes: true,
    },
  }
}

describe('readable text on components', () => {
  const selectorItems = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ]

  it("gives a card the page's colour, and follows it as the image changes", () => {
    const page = (color: string) => (
      <BackdropPaletteContext value={palette(color)}>
        <Card data-testid="card" />
      </BackdropPaletteContext>
    )
    const { rerender } = render(page(PAGE))
    const card = screen.getByTestId('card')
    expect(card.style.getPropertyValue('--_prism-card-fg')).toBe(PAGE)

    rerender(page('#111318'))
    expect(card.style.getPropertyValue('--_prism-card-fg')).toBe('#111318')
  })

  it('gives every kind of control the same colour', () => {
    const { container } = render(
      <BackdropPaletteContext value={palette(PAGE)}>
        <Card data-testid="card" />
        <Button>Go</Button>
        <Textbox aria-label="Name" />
        <Textarea aria-label="Notes" />
        <HorizontalSelector items={selectorItems} value="a" aria-label="Across" />
        <VerticalSelector items={selectorItems} value="a" aria-label="Down" />
        <CardGrid items={[{ id: 'a', title: 'Alpha', content: 'First' }]} />
      </BackdropPaletteContext>,
    )
    const given = (selector: string, property: string) =>
      [...container.querySelectorAll<HTMLElement>(selector)].map((el) => el.style.getPropertyValue(property))

    expect(new Set(given('.prism-card', '--_prism-card-fg'))).toEqual(new Set([PAGE]))
    expect(given('.prism-button', '--_prism-button-fg')).toEqual([PAGE])
    expect(given('.prism-textbox', '--_prism-textbox-fg')).toEqual([PAGE, PAGE])
    expect(new Set(given('.prism-horizontal-selector', '--_prism-horizontal-selector-fg'))).toEqual(new Set([PAGE]))
    expect(given('.prism-vertical-selector', '--_prism-vertical-selector-fg')).toEqual([PAGE])
    expect(given('.prism-card-grid__tray', '--_prism-horizontal-selector-fg')).toEqual([PAGE])
  })

  it('can be turned off', () => {
    render(
      <BackdropPaletteContext value={palette(PAGE)}>
        <Card data-testid="card" readableText={false} />
        <Textbox aria-label="Name" readableText={false} className="off" />
      </BackdropPaletteContext>,
    )
    expect(screen.getByTestId('card').style.getPropertyValue('--_prism-card-fg')).toBe('')
    expect(document.querySelector<HTMLElement>('.off')!.style.getPropertyValue('--_prism-textbox-fg')).toBe('')
  })

  it('keeps the CSS colour outside a GlassBackdrop', () => {
    render(<Card data-testid="card" style={{ ['--prism-card-fg' as string]: '#111318' }} />)
    expect(screen.getByTestId('card').style.getPropertyValue('--_prism-card-fg')).toBe('')
  })

  it("passes readableText on to the grid's cards and tray", () => {
    const { container } = render(
      <BackdropPaletteContext value={palette(PAGE)}>
        <CardGrid items={[{ id: 'a', title: 'Alpha', content: 'First' }]} readableText={false} />
      </BackdropPaletteContext>,
    )
    expect(container.querySelector<HTMLElement>('.prism-card')!.style.getPropertyValue('--_prism-card-fg')).toBe('')
    expect(
      container
        .querySelector<HTMLElement>('.prism-card-grid__tray-track')!
        .style.getPropertyValue('--_prism-horizontal-selector-fg'),
    ).toBe('')
  })

  describe('on a popup', () => {
    const popup = (open: boolean, { page = PAGE, readableText = true } = {}) => (
      <BackdropPaletteContext value={palette(page)}>
        <Popup open={open} anchor={{ x: 10, y: 10 }} readableText={readableText} data-testid="popup">
          Menu
        </Popup>
      </BackdropPaletteContext>
    )
    const color = () => screen.getByTestId('popup').style.getPropertyValue('--_prism-popup-fg')

    it("takes the page's colour as it opens", () => {
      const { rerender } = render(popup(false))
      expect(color()).toBe('')
      rerender(popup(true))
      expect(color()).toBe(PAGE)
    })

    it('keeps the colour as it closes, for the fade out', () => {
      const { rerender } = render(popup(true))
      rerender(popup(false))
      expect(color()).toBe(PAGE)
    })

    it("doesn't follow the page while closed, but catches up as it opens", () => {
      const { rerender } = render(popup(true))
      rerender(popup(false))
      rerender(popup(false, { page: '#223344' }))
      expect(color()).toBe(PAGE)

      rerender(popup(true, { page: '#223344' }))
      expect(color()).toBe('#223344')
    })

    it('drops the colour once readableText is off, open or closed', () => {
      const { rerender } = render(popup(true))
      rerender(popup(true, { readableText: false }))
      expect(color()).toBe('')

      rerender(popup(true))
      rerender(popup(false))
      rerender(popup(false, { readableText: false }))
      expect(color()).toBe('')
    })
  })
})
