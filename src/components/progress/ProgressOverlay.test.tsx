import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubDialogs } from '../../../test/dom'
import { BackdropPaletteContext, OverlayBackdropContext, type OverlayBackdrop } from '../backdrop'
import type { ReadablePage } from '../../contrast'
import { ProgressOverlay } from './ProgressOverlay'
import { progressOverlayStyles } from './ProgressOverlay.styles'

const PAGE: ReadablePage = {
  foreground: 'var(--_prism-page-fg)',
  background: '#24272e',
  glassOpacity: 0.3,
  dimmest: 0,
  selection: {} as ReadablePage['selection'],
}

function overlay() {
  return document.querySelector('dialog')!
}

function ring() {
  return screen.getByRole('progressbar', { hidden: true })
}

function fakeOverlayBackdrop() {
  const stop = vi.fn<() => void>()
  const backdrop = {
    trackOverlay: vi.fn<OverlayBackdrop['trackOverlay']>(() => stop),
    invalidate: vi.fn<OverlayBackdrop['invalidate']>(),
  } satisfies OverlayBackdrop
  return { backdrop, stop }
}

beforeEach(() => {
  stubDialogs()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ProgressOverlay', () => {
  it('shows as a modal dialog while open, and closes when it stops being', () => {
    const { rerender } = render(<ProgressOverlay open={false} />)
    expect(overlay().open).toBe(false)
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled()

    rerender(<ProgressOverlay open />)
    expect(overlay().open).toBe(true)
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()

    rerender(<ProgressOverlay open={false} />)
    expect(overlay().open).toBe(false)
  })

  it('closes if it goes while open, leaving the page usable', () => {
    const { unmount } = render(<ProgressOverlay open />)
    const dialog = overlay()
    unmount()
    expect(dialog.open).toBe(false)
  })

  it('names itself and the ring inside it Loading, unless told otherwise', () => {
    const { rerender } = render(<ProgressOverlay open />)
    expect(overlay().getAttribute('aria-label')).toBe('Loading')
    expect(ring().getAttribute('aria-label')).toBe('Loading')
    expect(ring().getAttribute('aria-valuenow')).toBeNull()

    rerender(<ProgressOverlay open aria-label="Saving" />)
    expect(overlay().getAttribute('aria-label')).toBe('Saving')
    expect(ring().getAttribute('aria-label')).toBe('Saving')
  })

  it("can't be dismissed: Escape only tells onCancel", () => {
    const onCancel = vi.fn<() => void>()
    render(<ProgressOverlay open onCancel={onCancel} />)

    expect(overlay().getAttribute('closedby')).toBe('none')
    // false: its default, closing, was prevented.
    expect(fireEvent(overlay(), new Event('cancel', { cancelable: true }))).toBe(false)
    expect(onCancel).toHaveBeenCalledOnce()
    expect(overlay().open).toBe(true)
  })

  it('passes other dialog props through, after its own class', () => {
    render(<ProgressOverlay open id="o1" className="mine" />)
    expect(overlay().id).toBe('o1')
    expect([...overlay().classList]).toEqual(['prism-progress-overlay', 'mine'])
  })

  it('forwards its element to a ref object', () => {
    const ref = createRef<HTMLDialogElement>()
    render(<ProgressOverlay open={false} ref={ref} />)
    expect(ref.current).toBe(overlay())
  })

  it('draws the ring its glass on a canvas of its own, only while open', () => {
    const { backdrop, stop } = fakeOverlayBackdrop()
    const shown = (open: boolean) => (
      <OverlayBackdropContext value={backdrop}>
        <ProgressOverlay open={open} />
      </OverlayBackdropContext>
    )
    const { rerender } = render(shown(false))
    expect(backdrop.trackOverlay).not.toHaveBeenCalled()

    rerender(shown(true))
    const canvas = ring().querySelector('.prism-progress__glass > canvas')
    expect(backdrop.trackOverlay).toHaveBeenCalledExactlyOnceWith(ring(), canvas)

    rerender(shown(false))
    expect(stop).toHaveBeenCalledOnce()
  })

  it("takes the page's text colour for its fill, so it follows dark glass or light", () => {
    render(
      <BackdropPaletteContext value={PAGE}>
        <ProgressOverlay open />
      </BackdropPaletteContext>,
    )
    expect(ring().style.getPropertyValue('--_prism-progress-fill')).toBe(PAGE.foreground)
  })

  it('keeps a fill of its own with readableFill off', () => {
    render(
      <BackdropPaletteContext value={PAGE}>
        <ProgressOverlay open readableFill={false} />
      </BackdropPaletteContext>,
    )
    expect(ring().style.getPropertyValue('--_prism-progress-fill')).toBe('')
  })

  it('has no glass with refract off', () => {
    const { backdrop } = fakeOverlayBackdrop()
    render(
      <OverlayBackdropContext value={backdrop}>
        <ProgressOverlay open refract={false} />
      </OverlayBackdropContext>,
    )
    expect(backdrop.trackOverlay).not.toHaveBeenCalled()
    expect(ring().querySelector('canvas')).toBeNull()
  })
})

describe('progressOverlayStyles', () => {
  /** The declarations of the rule for exactly `selector`. */
  function rule(selector: string) {
    const at = progressOverlayStyles.indexOf(`\n${selector} {`)
    return progressOverlayStyles.slice(at, progressOverlayStyles.indexOf('}', at))
  }

  it('dims the page, without blurring it', () => {
    expect(rule('.prism-progress-overlay[open]')).toContain('background: var(--prism-progress-dim)')
    expect(progressOverlayStyles).not.toContain('backdrop-filter')
  })

  it('fades the dim at its own pace, rather than with the ring by the opacity of them both', () => {
    expect(rule('.prism-progress-overlay')).toContain('background: transparent')
    expect(rule('.prism-progress-overlay')).toContain('transition-timing-function: var(--prism-progress-dim-easing)')
    expect(rule('.prism-progress-overlay')).not.toContain('opacity')
    expect(rule('.prism-progress-overlay[open]')).not.toContain('opacity')
    expect(rule('.prism-progress-overlay > .prism-progress')).toContain('opacity: 0')
    expect(rule('.prism-progress-overlay[open] > .prism-progress')).toContain('opacity: 1')
    expect(progressOverlayStyles).toContain('.prism-progress-overlay[open] { background-color: transparent; }')
  })

  it('lets presses through to the page as it fades out', () => {
    expect(rule('.prism-progress-overlay')).toContain('pointer-events: none')
    expect(rule('.prism-progress-overlay[open]')).toContain('pointer-events: auto')
  })

  it('keeps the ring centred as it fades out, not just while open', () => {
    expect(rule('.prism-progress-overlay')).toContain('align-items: center')
    expect(rule('.prism-progress-overlay')).toContain('justify-content: center')
    expect(rule('.prism-progress-overlay[open]')).not.toContain('align-items')
  })

  it('stays displayed and on top until it has faded out', () => {
    expect(rule('.prism-progress-overlay')).toContain('transition-property: background-color, display, overlay')
    expect(rule('.prism-progress-overlay')).toContain('transition-behavior: allow-discrete')
  })
})
