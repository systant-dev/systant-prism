import { fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchScrollbars, type Scrollbars } from './scrollbars'

let scrollbars: Scrollbars | undefined

afterEach(() => {
  scrollbars?.stop()
  scrollbars = undefined
})

/** Gives `el` a layout jsdom lacks, with a scrollTop it keeps. */
function lay(el: HTMLElement, sizes: Record<string, number>) {
  for (const [name, value] of Object.entries(sizes)) {
    Object.defineProperty(el, name, { value, writable: true, configurable: true })
  }
  return el
}

/** A 200px-tall viewport over 600px of content, and a bar 32px shorter with a 10px scrollbar (or none). */
function setUp(thickness = 10) {
  const viewport = lay(document.createElement('div'), { clientHeight: 200, scrollHeight: 600, scrollTop: 0 })
  const bar = lay(document.createElement('div'), {
    clientHeight: 168,
    offsetWidth: thickness + 1,
    clientWidth: 1,
    scrollTop: 0,
  })
  bar.append(document.createElement('div'))
  const native = vi.fn<(native: boolean) => void>()
  scrollbars = watchScrollbars(viewport, { y: bar }, native)
  return { viewport, bar, extent: bar.firstElementChild as HTMLElement, native }
}

describe('watchScrollbars', () => {
  it('sizes the bar so its thumb is in proportion to the content', () => {
    const { bar, extent, native } = setUp()
    expect(extent.style.height).toBe('504px')
    expect(bar.style.visibility).toBe('')
    expect(native).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('measures again when asked, for a change nothing reports', () => {
    const { viewport, extent } = setUp()
    lay(viewport, { scrollHeight: 800 })
    expect(extent.style.height).toBe('504px')

    scrollbars!.refresh()
    expect(extent.style.height).toBe('672px')
  })

  it('hides a bar with nothing to scroll', () => {
    const { viewport, bar } = setUp()
    lay(viewport, { scrollHeight: 200 })
    fireEvent.scroll(viewport)
    expect(bar.style.visibility).toBe('hidden')
  })

  it('moves the bar as the viewport scrolls', () => {
    const { viewport, bar } = setUp()
    viewport.scrollTop = 100
    fireEvent.scroll(viewport)
    expect(bar.scrollTop).toBe(84)
  })

  it('scrolls the viewport as the bar does, without echoing it back mid-glide', () => {
    const { viewport, bar } = setUp()
    bar.scrollTop = 42
    fireEvent.scroll(bar)
    expect(viewport.scrollTop).toBe(50)

    // The bar glides on before the viewport's scroll arrives.
    bar.scrollTop = 45
    fireEvent.scroll(viewport)
    expect(bar.scrollTop).toBe(45)
  })

  it("doesn't scroll the viewport back when the bar's echo arrives mid-glide", () => {
    const { viewport, bar } = setUp()
    viewport.scrollTop = 100
    fireEvent.scroll(viewport)

    viewport.scrollTop = 120
    fireEvent.scroll(bar)
    expect(viewport.scrollTop).toBe(120)
  })

  it('leaves scrollbars that overlay the content to the viewport', () => {
    const { bar, native } = setUp(0)
    expect(native).toHaveBeenCalledExactlyOnceWith(true)
    expect(bar.style.visibility).toBe('hidden')
  })

  it('stops following when stopped', () => {
    const { viewport, bar } = setUp()
    scrollbars!.stop()
    scrollbars = undefined
    bar.scrollTop = 42
    fireEvent.scroll(bar)
    viewport.scrollTop = 100
    fireEvent.scroll(viewport)
    expect([viewport.scrollTop, bar.scrollTop]).toEqual([100, 42])
  })
})
