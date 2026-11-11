import { cleanup, render, screen } from '@testing-library/react'
import { useRef, type CSSProperties } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ReadablePage, ReadableSelection } from '../../contrast'
import { BackdropPaletteContext } from './BackdropContext'
import { glassSelection, useGlassSelection } from './useGlassSelection'

const PROPERTIES = { textProperty: '--text', accentProperty: '--accent' }
const INK = '#111318'
const ACCENT = '#6d7cff'
const PAGE: ReadableSelection = {
  background: '#794d2a',
  color: '#eceef2',
  ratio: 7,
  target: 4.5,
  separation: 3,
  separationTarget: 3,
  passes: true,
}

function box(style: CSSProperties) {
  const el = document.createElement('div')
  Object.assign(el.style, style)
  for (const [key, value] of Object.entries(style)) {
    if (key.startsWith('--')) el.style.setProperty(key, value as string)
  }
  document.body.append(el)
  return el
}

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

describe('glassSelection', () => {
  const colours = { '--text': INK, '--accent': ACCENT } as CSSProperties
  const glass = { ...colours, backgroundColor: 'rgb(243 244 246 / 0.6)' }

  it("gives glass the page's selection", () => {
    expect(glassSelection(box(glass), PROPERTIES, PAGE)).toBe(PAGE)
  })

  it('gives the same selection whatever the tint', () => {
    const other = box({ ...colours, backgroundColor: 'rgb(17 19 24 / 0.3)' })
    expect(glassSelection(other, PROPERTIES, PAGE)).toBe(PAGE)
  })

  it('stops at the backdrop, whose canvas is drawn over its background', () => {
    const backdrop = box({ backgroundColor: '#000000' })
    backdrop.className = 'prism-backdrop'
    const el = box(glass)
    backdrop.append(el)
    expect(glassSelection(el, PROPERTIES, PAGE)).toBe(PAGE)
  })

  it("judges anything opaque for itself, as the page's colours say nothing of it", () => {
    const el = box({ ...colours, backgroundColor: '#ffffff' })
    expect(glassSelection(el, PROPERTIES, PAGE)).toMatchObject({ background: ACCENT, color: INK })
  })

  it('keeps the colours given where they do', () => {
    const el = box({ ...colours, backgroundColor: '#ffffff' })
    expect(glassSelection(el, PROPERTIES, null)).toMatchObject({ background: ACCENT, color: INK })
  })

  it('judges glass over white and black without a page, rather than giving up', () => {
    const selection = glassSelection(box(glass), PROPERTIES, null)
    expect(selection?.background).not.toBe(ACCENT)
    expect(selection?.passes).toBe(true)
  })

  it('leaves a colour it cannot read to the CSS', () => {
    expect(glassSelection(box({ '--text': INK } as CSSProperties), PROPERTIES, null)).toBeNull()
    expect(
      glassSelection(box({ '--text': 'oklch(0.5 0.1 200)', '--accent': ACCENT } as CSSProperties), PROPERTIES, null),
    ).toBeNull()
  })
})

function Host({ enabled }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const selection = useGlassSelection(ref, PROPERTIES, enabled)
  return (
    <div
      ref={ref}
      data-testid="host"
      data-background={selection?.background}
      style={{ '--text': INK, '--accent': ACCENT, backgroundColor: 'rgb(243 244 246 / 0.6)' } as CSSProperties}
    />
  )
}

function background() {
  return screen.getByTestId('host').dataset.background
}

function page(selection: ReadableSelection) {
  return (
    <BackdropPaletteContext value={{ foreground: INK, background: '#f3f4f6', selection } as ReadablePage}>
      <Host />
    </BackdropPaletteContext>
  )
}

describe('useGlassSelection', () => {
  it("takes the page's selection, and changes with it", () => {
    const { rerender } = render(page(PAGE))
    expect(background()).toBe(PAGE.background)

    rerender(page({ ...PAGE, background: '#455870' }))
    expect(background()).toBe('#455870')
  })

  it('goes back to its own colours when the page has none', () => {
    const { rerender } = render(page(PAGE))
    rerender(<Host />)
    expect(background()).not.toBe(PAGE.background)
  })

  it('reads nothing when turned off', () => {
    render(<Host enabled={false} />)
    expect(background()).toBeUndefined()
  })
})
