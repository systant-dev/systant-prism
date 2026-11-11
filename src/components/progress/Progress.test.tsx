import { cleanup, render, screen } from '@testing-library/react'
import { createRef, type CSSProperties } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeBackdrop } from '../../../test/selector'
import { BackdropContext, BackdropPaletteContext } from '../backdrop'
import type { ReadablePage } from '../../contrast'
import { Progress } from './Progress'
import { progressStyles } from './Progress.styles'

const FILL = '--_prism-progress-fill'

const PAGE: ReadablePage = {
  foreground: 'var(--_prism-page-fg)',
  background: '#24272e',
  glassOpacity: 0.3,
  dimmest: 0,
  selection: {} as ReadablePage['selection'],
}

function progress() {
  return screen.getByRole('progressbar')
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Progress', () => {
  it('is an indeterminate progressbar, named Loading unless given a name', () => {
    const { rerender } = render(<Progress />)

    expect(progress().tagName).toBe('DIV')
    expect(progress().getAttribute('aria-valuenow')).toBeNull()
    expect(progress().getAttribute('aria-label')).toBe('Loading')

    rerender(<Progress aria-label="Saving" />)
    expect(progress().getAttribute('aria-label')).toBe('Saving')
  })

  it('draws its spinning fill and its hole from layers hidden from assistive technology', () => {
    render(<Progress />)

    expect([...progress().children].map((child) => child.className)).toEqual([
      'prism-progress__spin',
      'prism-progress__hole',
    ])
    for (const child of progress().children) expect(child.getAttribute('aria-hidden')).toBe('true')
  })

  it('passes other div props through, after its own class', () => {
    render(<Progress id="p1" className="mine" style={{ '--prism-progress-size': '64px' } as CSSProperties} />)

    expect(progress().id).toBe('p1')
    expect([...progress().classList]).toEqual(['prism-progress', 'mine'])
    expect(progress().style.getPropertyValue('--prism-progress-size')).toBe('64px')
  })

  it('forwards its element to a ref object', () => {
    const ref = createRef<HTMLDivElement>()
    render(<Progress ref={ref} />)
    expect(ref.current).toBe(progress())
  })

  it('has a backdrop draw its glass, unless turned off', () => {
    const { backdrop } = fakeBackdrop()
    const { rerender } = render(
      <BackdropContext value={backdrop}>
        <Progress />
      </BackdropContext>,
    )
    expect(backdrop.track).toHaveBeenCalledExactlyOnceWith(progress())

    backdrop.track.mockClear()
    rerender(
      <BackdropContext value={backdrop}>
        <Progress refract={false} />
      </BackdropContext>,
    )
    expect(backdrop.track).not.toHaveBeenCalled()
  })

  it("takes the page's text colour for its fill on glass, so it follows dark glass or light", () => {
    render(
      <BackdropPaletteContext value={PAGE}>
        <Progress />
      </BackdropPaletteContext>,
    )
    expect(progress().style.getPropertyValue(FILL)).toBe(PAGE.foreground)
  })

  it('keeps a fill of its own with readableFill off', () => {
    render(
      <BackdropPaletteContext value={PAGE}>
        <Progress readableFill={false} />
      </BackdropPaletteContext>,
    )
    expect(progress().style.getPropertyValue(FILL)).toBe('')
  })

  it('keeps the fill readable on an opaque background', () => {
    render(
      <div style={{ background: '#111318', color: '#111318' }}>
        <Progress style={{ '--prism-progress-fill': '#111318' } as CSSProperties} />
      </div>,
    )
    expect(progress().style.getPropertyValue(FILL)).not.toBe('')
  })
})

describe('progressStyles', () => {
  /** Each stop of the fade along the hoop, its strength and how far round it lies, for a 45° arc fading over 34°. */
  function stopsAlongHoop() {
    const conic = /mask-image: conic-gradient\((.*?)\), radial-gradient/s.exec(progressStyles)![1]
    return [
      ...conic.matchAll(
        /rgb\(0 0 0 \/ ([\d.]+)\) calc\((?:var\(--prism-progress-arc\) \+ )?var\(--prism-progress-arc-fade\) \* ([\d.]+)\)/g,
      ),
    ].map(([match, alpha, along]) => ({
      alpha: Number(alpha),
      at: (match.includes('arc) +') ? 45 : 0) + 34 * Number(along),
    }))
  }

  it('fades the fill smoothly in and out at both ends, with a full stretch between', () => {
    const stops = stopsAlongHoop()
    const peak = stops.findIndex(({ alpha }) => alpha === 1)
    const rise = stops.slice(0, peak + 1).map(({ alpha }) => alpha)
    const fall = stops.slice(peak + 1).map(({ alpha }) => alpha)
    const positions = stops.map(({ at }) => at)
    const ascending = (values: number[]) => [...new Set(values)].sort((a, b) => a - b)

    expect(stops.length).toBeGreaterThan(16)
    expect(stops[0]).toEqual({ alpha: 0, at: 0 })
    expect(stops.at(-1)).toEqual({ alpha: 0, at: 79 })
    // Round the hoop in order: stops out of order would draw a hard edge.
    expect(positions).toEqual(ascending(positions))
    expect(rise).toEqual(ascending(rise))
    expect(fall).toEqual(ascending(fall).reverse())
  })

  it('is an eighth of the way round at half strength', () => {
    const stops = stopsAlongHoop()
    const half = stops.filter(({ alpha }) => alpha === 0.5).map(({ at }) => at)
    expect(half[1] - half[0]).toBeCloseTo(45)
  })

  it('bends at the bottom of the hoop and frosts at the top, with far more blur there', () => {
    const blur = progressStyles.match(/--prism-refraction-blur: (\d+)px/)![1]
    const frost = progressStyles.match(/--prism-refraction-frost: (\d+)px/)![1]
    expect(Number(frost)).toBeGreaterThan(Number(blur) * 2)
  })

  it('softens the edges of the glass, its tint and its light by the one token', () => {
    expect(progressStyles).toContain('--prism-refraction-soft: var(--prism-progress-edge-soft)')
    expect(progressStyles).toContain('filter: blur(calc(var(--prism-progress-edge-soft) / 3))')
  })

  it('turns at a constant speed for ever, and holds still with prefers-reduced-motion', () => {
    expect(progressStyles).toContain('prism-progress-spin var(--prism-progress-duration) linear infinite')

    const reduced = /@media \(prefers-reduced-motion: reduce\) \{(.*?)\n\}/s.exec(progressStyles)![1]
    expect(reduced).toContain('prism-progress-breathe')
    expect(reduced).not.toContain('prism-progress-spin')
  })
})
