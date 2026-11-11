import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes } from '../../../../test/dom'
import { ScrollArea } from './ScrollArea'
import { scrollAreaStyles } from './ScrollArea.styles'

let resizes: ReturnType<typeof manualResizes>

function area() {
  return screen.getByTestId('area')
}

function viewport() {
  return area().querySelector<HTMLElement>('.prism-scroll-area__viewport')!
}

function fadeOf(el: HTMLElement) {
  return ['top', 'right', 'bottom', 'left'].map((side) => el.style.getPropertyValue(`--prism-scroll-fade-${side}`))
}

/**
 * Lays the viewport out in jsdom, which has none: 300×200 with an 8px
 * scrollbar down the right, showing a 600px-tall column of content from `scrollTop`.
 */
function layOut(scrollTop: number, scrollWidth = 292) {
  const el = viewport()
  Object.defineProperties(el, {
    offsetWidth: { value: 300, configurable: true },
    offsetHeight: { value: 200, configurable: true },
    clientWidth: { value: 292, configurable: true },
    clientHeight: { value: 200, configurable: true },
    scrollWidth: { value: scrollWidth, configurable: true },
    scrollHeight: { value: 600, configurable: true },
    scrollTop: { value: scrollTop, configurable: true },
  })
  fireEvent.scroll(el)
}

beforeEach(() => {
  resizes = manualResizes()
  // Stands in for the stylesheet, whose var() and overflow shorthand jsdom can't resolve.
  const sheet = document.createElement('style')
  sheet.textContent = `
    .prism-scroll-area__viewport.prism-scroll-fade { --prism-scroll-fade: 16px; }
    .prism-scroll-area--y > .prism-scroll-area__viewport { overflow-x: hidden; overflow-y: auto; }
    .prism-scroll-area--both > .prism-scroll-area__viewport { overflow-x: auto; overflow-y: auto; }
  `
  document.head.append(sheet)
})

afterEach(() => {
  cleanup()
  document.head.replaceChildren()
  vi.unstubAllGlobals()
})

describe('ScrollArea', () => {
  it('puts its props on the area and its children in a viewport with glass scrollbars that fades', () => {
    render(
      <ScrollArea data-testid="area" className="mine" style={{ height: 200 }}>
        <p>Content</p>
      </ScrollArea>,
    )

    expect([...area().classList]).toEqual(['prism-scroll-area', 'prism-scroll-area--y', 'mine'])
    expect(area().style.height).toBe('200px')
    expect([...viewport().classList]).toEqual(['prism-scroll-area__viewport', 'prism-scrollbar', 'prism-scroll-fade'])
    expect(viewport().textContent).toBe('Content')
  })

  it('scrolls the way `axis` says', () => {
    render(<ScrollArea data-testid="area" axis="both" />)
    expect(area().classList.contains('prism-scroll-area--both')).toBe(true)
  })

  it('fades each edge that has content beyond it, ramping in over the first px scrolled', () => {
    render(<ScrollArea data-testid="area" />)
    expect(fadeOf(viewport())).toEqual(['0px', '0px', '0px', '0px'])

    layOut(0)
    expect(fadeOf(viewport())).toEqual(['0px', '0px', '16px', '0px'])

    layOut(5)
    expect(fadeOf(viewport())).toEqual(['5px', '0px', '16px', '0px'])

    layOut(400)
    expect(fadeOf(viewport())).toEqual(['16px', '0px', '0px', '0px'])
  })

  it("doesn't fade content too wide for it at the sides it clips", () => {
    render(<ScrollArea data-testid="area" />)
    layOut(5, 500)
    expect(fadeOf(viewport())).toEqual(['5px', '0px', '16px', '0px'])
  })

  it('remeasures when its content resizes', () => {
    render(<ScrollArea data-testid="area" />)
    layOut(0)
    Object.defineProperty(viewport(), 'scrollHeight', { value: 200 })
    resizes.resize(viewport(), 300, 200)
    expect(fadeOf(viewport())).toEqual(['0px', '0px', '0px', '0px'])
  })

  it('remeasures when text right inside it changes', async () => {
    const { rerender } = render(<ScrollArea data-testid="area">Short</ScrollArea>)
    layOut(0)
    Object.defineProperty(viewport(), 'scrollHeight', { value: 200 })
    rerender(<ScrollArea data-testid="area">Shorter</ScrollArea>)
    await Promise.resolve()
    expect(fadeOf(viewport())).toEqual(['0px', '0px', '0px', '0px'])
  })

  it('only fades a cut-off edge: nothing lies over the content there to blur it', () => {
    render(<ScrollArea data-testid="area" axis="both" />)
    layOut(5)

    expect([...area().children].map((el) => el.className.split(' ')[0])).toEqual([
      'prism-scroll-area__viewport',
      'prism-scroll-area__bar',
      'prism-scroll-area__bar',
    ])
    expect(scrollAreaStyles).not.toMatch(/blur|backdrop-filter/)
  })

  it('has a bar per way it scrolls, hidden from assistive tech and Tab', () => {
    const bars = () =>
      [...area().querySelectorAll<HTMLElement>('.prism-scroll-area__bar')].map((el) => el.className.split(' ')[1])
    const { rerender } = render(<ScrollArea data-testid="area" />)
    expect(bars()).toEqual(['prism-scroll-area__bar--y'])
    rerender(<ScrollArea data-testid="area" axis="x" />)
    expect(bars()).toEqual(['prism-scroll-area__bar--x'])
    rerender(<ScrollArea data-testid="area" axis="both" />)
    expect(bars()).toEqual(['prism-scroll-area__bar--y', 'prism-scroll-area__bar--x'])

    const bar = area().lastElementChild as HTMLElement
    expect(bar.classList.contains('prism-scrollbar')).toBe(true)
    expect(bar.getAttribute('aria-hidden')).toBe('true')
    expect(bar.tabIndex).toBe(-1)
  })

  it('gives the viewport its own scrollbars back where they overlay the content', () => {
    // jsdom lays nothing out, so its bars come out 0 thick, as overlay scrollbars do.
    render(<ScrollArea data-testid="area" />)
    expect(area().hasAttribute('data-native-scrollbars')).toBe(true)
  })

  it('hands the area to ref', () => {
    const ref = createRef<HTMLDivElement>()
    render(<ScrollArea data-testid="area" ref={ref} />)
    expect(ref.current).toBe(area())
  })

  it("doesn't fade with `fade` off", () => {
    render(<ScrollArea data-testid="area" fade={false} />)
    layOut(5)
    expect(viewport().classList.contains('prism-scroll-fade')).toBe(false)
    expect(fadeOf(viewport())).toEqual(['', '', '', ''])
  })

  it('hands the viewport to viewportRef and its scrolls to onScroll', () => {
    const ref = createRef<HTMLDivElement>()
    const onScroll = vi.fn<() => void>()
    render(<ScrollArea data-testid="area" viewportRef={ref} onScroll={onScroll} />)

    expect(ref.current).toBe(viewport())
    fireEvent.scroll(viewport())
    expect(onScroll).toHaveBeenCalledTimes(1)
  })

  it('puts viewportProps on the viewport, keeping its own classes', () => {
    render(<ScrollArea data-testid="area" viewportProps={{ tabIndex: 0, 'aria-label': 'Log', className: 'pane' }} />)

    expect(viewport().tabIndex).toBe(0)
    expect(viewport().getAttribute('aria-label')).toBe('Log')
    expect([...viewport().classList]).toEqual([
      'prism-scroll-area__viewport',
      'prism-scrollbar',
      'prism-scroll-fade',
      'pane',
    ])
    expect(area().hasAttribute('aria-label')).toBe(false)
  })
})
