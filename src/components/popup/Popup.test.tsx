import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes } from '../../../test/dom'
import {
  BackdropContext,
  OverlayBackdropContext,
  useBackdropLens,
  type Backdrop,
  type OverlayBackdrop,
} from '../backdrop'
import { trackLight } from '../../shared/lightSource'
import { Popup, type PopupProps } from './Popup'

// The light source is tested on its own; here only whether the popup registers with it matters.
const untrack = vi.hoisted(() => vi.fn<() => void>())
vi.mock('../../shared/lightSource', () => ({ trackLight: vi.fn<typeof trackLight>(() => untrack) }))

// jsdom has no popovers: these record whether each element is showing.
const showing = new Set<Element>()

function popup() {
  return screen.getByTestId('popup')
}

function anchor() {
  return screen.getByRole('button', { name: 'Anchor' })
}

/** A 200 × 100 popup under a 1000 × 800 viewport, beside a button at (100, 100), 80 × 30. */
function Host({ anchorAt = true, ...props }: Partial<PopupProps> & { anchorAt?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={ref}>Anchor</button>
      <button>Elsewhere</button>
      <Popup data-testid="popup" open anchor={anchorAt ? ref : { x: 300, y: 200 }} {...props}>
        <button>Inside</button>
      </Popup>
    </>
  )
}

beforeEach(() => {
  manualResizes()
  vi.mocked(trackLight).mockClear()
  untrack.mockClear()
  showing.clear()
  HTMLElement.prototype.showPopover = function () {
    showing.add(this)
  }
  HTMLElement.prototype.hidePopover = function () {
    showing.delete(this)
  }
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000)
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 100, y: 100, width: 80, height: 30 }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  // @ts-expect-error -- jsdom has none of its own
  delete HTMLElement.prototype.showPopover
  // @ts-expect-error -- as above
  delete HTMLElement.prototype.hidePopover
})

describe('Popup', () => {
  it('is a manual popover, closed', () => {
    render(<Host open={false} className="mine" />)

    expect(popup().getAttribute('popover')).toBe('manual')
    expect([...popup().classList]).toEqual(['prism-popup', 'prism-popup--pad-sm', 'prism-edge-light', 'mine'])
    expect(showing.has(popup())).toBe(false)
  })

  it('shows while open, its rim lit from the pointer', () => {
    const { rerender } = render(<Host open={false} />)

    rerender(<Host open />)
    expect(showing.has(popup())).toBe(true)
    expect([...popup().classList]).toEqual(['prism-popup', 'prism-popup--pad-sm', 'prism-edge-light'])
    expect(trackLight).toHaveBeenCalledWith(popup(), '--prism-edge-light-size')

    rerender(<Host open={false} />)
    expect(showing.has(popup())).toBe(false)
    expect(untrack).toHaveBeenCalled()
  })

  it('keeps its lit rim as it fades out, no longer following the pointer', () => {
    const { rerender } = render(<Host open />)
    rerender(<Host open={false} />)

    expect(popup().querySelector('.prism-edge-light__ring')).not.toBeNull()
    expect(untrack).toHaveBeenCalled()
  })

  it('draws the button rim after its content, and the light over the rim', () => {
    render(<Host />)
    expect(popup().firstElementChild?.textContent).toBe('Inside')
    const rim = popup().querySelector(':scope > .prism-rim')
    expect(rim?.getAttribute('aria-hidden')).toBe('true')
    // A popup is never pressed, so its rim never turns.
    expect(rim?.classList.contains('prism-rim--turns')).toBe(false)
    expect(rim?.nextElementSibling?.classList.contains('prism-edge-light__ring')).toBe(true)
  })

  it('turns highlight off', () => {
    render(<Host highlight={false} />)
    expect(popup().classList.contains('prism-edge-light')).toBe(false)
  })

  it('opens below its anchor element, 8px from it, by default', () => {
    render(<Host />)
    expect(popup().style.left).toBe('100px')
    expect(popup().style.top).toBe('138px')
  })

  it('takes side, align and offset', () => {
    render(<Host side="right" align="end" offset={4} />)
    expect(popup().style.left).toBe('184px')
    // Its bottom on the anchor's.
    expect(popup().style.top).toBe('30px')
  })

  it('takes alignOffset, in from the edge it lines up with', () => {
    render(<Host side="right" alignOffset={-4} />)
    expect(popup().style.top).toBe('96px')
  })

  it('opens with its corner on a point', () => {
    render(<Host anchorAt={false} />)
    expect(popup().style.left).toBe('300px')
    expect(popup().style.top).toBe('200px')
  })

  it('follows its anchor as the page scrolls', () => {
    render(<Host />)
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue(
      DOMRect.fromRect({ x: 100, y: 60, width: 80, height: 30 }),
    )
    fireEvent.scroll(document)
    expect(popup().style.top).toBe('98px')
  })

  it('asks to close on a press outside it and its anchor', () => {
    const onClose = vi.fn<() => void>()
    render(<Host onClose={onClose} />)

    fireEvent.pointerDown(screen.getByText('Inside'))
    fireEvent.pointerDown(anchor())
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('doesn’t ask to close while closed', () => {
    const onClose = vi.fn<() => void>()
    render(<Host open={false} onClose={onClose} />)
    fireEvent.pointerDown(document.body)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('asks to close on Escape, returning focus to where it was', () => {
    const onClose = vi.fn<() => void>()
    const { rerender } = render(<Host open={false} onClose={onClose} />)
    anchor().focus()
    rerender(<Host open onClose={onClose} />)
    screen.getByText('Inside').focus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(anchor())
  })

  it('closes only the latest open popup on Escape', () => {
    const outer = vi.fn<() => void>()
    const inner = vi.fn<() => void>()
    render(
      <Popup open anchor={{ x: 0, y: 0 }} onClose={outer}>
        <Popup open anchor={{ x: 0, y: 0 }} onClose={inner} />
      </Popup>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(inner).toHaveBeenCalledOnce()
    expect(outer).not.toHaveBeenCalled()
  })

  it("keeps glass inside it off a GlassBackdrop's canvas, which is under the page", () => {
    const backdrop = {
      track: vi.fn<Backdrop['track']>(() => () => {}),
      invalidate: vi.fn<Backdrop['invalidate']>(),
      moving: vi.fn<Backdrop['moving']>(() => () => {}),
    }
    function Lensed() {
      const ref = useRef<HTMLDivElement>(null)
      return <div ref={ref} data-testid="lensed" data-lensed={useBackdropLens(ref)} />
    }
    render(
      <BackdropContext value={backdrop}>
        <Popup open anchor={{ x: 0, y: 0 }}>
          <Lensed />
        </Popup>
      </BackdropContext>,
    )

    expect(screen.getByTestId('lensed').dataset.lensed).toBe('false')
    expect(backdrop.track).not.toHaveBeenCalled()
  })

  describe('inside a GlassBackdrop', () => {
    function overlayBackdrop() {
      const stop = vi.fn<() => void>()
      const backdrop = {
        trackOverlay: vi.fn<OverlayBackdrop['trackOverlay']>(() => stop),
        invalidate: vi.fn<OverlayBackdrop['invalidate']>(),
      } satisfies OverlayBackdrop
      return { backdrop, stop }
    }
    const canvas = () => popup().querySelector<HTMLCanvasElement>('.prism-popup__glass > canvas')

    it('has the backdrop draw its glass onto a canvas of its own while open', () => {
      const { backdrop, stop } = overlayBackdrop()
      const { rerender } = render(
        <OverlayBackdropContext value={backdrop}>
          <Host open={false} />
        </OverlayBackdropContext>,
      )
      expect(backdrop.trackOverlay).not.toHaveBeenCalled()

      rerender(
        <OverlayBackdropContext value={backdrop}>
          <Host open />
        </OverlayBackdropContext>,
      )
      expect(backdrop.trackOverlay).toHaveBeenCalledExactlyOnceWith(popup(), canvas())
      expect(backdrop.invalidate).toHaveBeenCalled()

      rerender(
        <OverlayBackdropContext value={backdrop}>
          <Host open={false} />
        </OverlayBackdropContext>,
      )
      expect(stop).toHaveBeenCalledOnce()
      // Kept, so the glass fades out with the popup.
      expect(canvas()).not.toBeNull()
    })

    it('has no glass with refract off', () => {
      const { backdrop } = overlayBackdrop()
      render(
        <OverlayBackdropContext value={backdrop}>
          <Host open refract={false} />
        </OverlayBackdropContext>,
      )
      expect(canvas()).toBeNull()
      expect(backdrop.trackOverlay).not.toHaveBeenCalled()
    })

    it('has glass inside another popup too', () => {
      const { backdrop } = overlayBackdrop()
      render(
        <OverlayBackdropContext value={backdrop}>
          <Popup open anchor={{ x: 0, y: 0 }}>
            <Popup open anchor={{ x: 0, y: 0 }} data-testid="inner" />
          </Popup>
        </OverlayBackdropContext>,
      )
      expect(backdrop.trackOverlay).toHaveBeenCalledWith(screen.getByTestId('inner'), expect.anything())
    })
  })

  it('has no glass outside a GlassBackdrop', () => {
    render(<Host open />)
    expect(popup().querySelector('.prism-popup__glass')).toBeNull()
  })

  it('forwards its ref to the element', () => {
    const ref = createRef<HTMLDivElement>()
    render(<Host ref={ref} />)
    expect(ref.current).toBe(popup())
  })

  it('stops listening once closed', () => {
    const onClose = vi.fn<() => void>()
    const { rerender } = render(<Host onClose={onClose} />)
    rerender(<Host open={false} onClose={onClose} />)
    act(() => {
      fireEvent.pointerDown(document.body)
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})
