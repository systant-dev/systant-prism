import { cleanup, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Backdrop } from './backdrop'
import { BackdropContext } from './BackdropContext'
import { useBackdropLens } from './useBackdropLens'

const untrack = vi.fn<() => void>()
const backdrop = {
  track: vi.fn<Backdrop['track']>(() => untrack),
  invalidate: vi.fn<Backdrop['invalidate']>(),
  moving: vi.fn<Backdrop['moving']>(() => () => {}),
}

function Glass({ enabled = true, label = '' }: { enabled?: boolean; label?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const lensed = useBackdropLens(ref, enabled)
  return (
    <div ref={ref} data-testid="glass" data-lensed={lensed}>
      {label}
    </div>
  )
}

function InBackdrop(props: Parameters<typeof Glass>[0]) {
  return (
    <BackdropContext value={backdrop}>
      <Glass {...props} />
    </BackdropContext>
  )
}

function isLensed() {
  return screen.getByTestId('glass').dataset.lensed
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('useBackdropLens', () => {
  it('does nothing outside a backdrop', () => {
    render(<Glass />)
    expect(isLensed()).toBe('false')
  })

  it('has the backdrop draw glass behind the element', () => {
    render(<InBackdrop />)
    expect(isLensed()).toBe('true')
    expect(backdrop.track).toHaveBeenCalledExactlyOnceWith(screen.getByTestId('glass'))
  })

  it('asks for a redraw after every render, as its CSS may have changed', () => {
    const { rerender } = render(<InBackdrop />)
    rerender(<InBackdrop label="again" />)
    expect(backdrop.invalidate).toHaveBeenCalledTimes(2)
    expect(backdrop.track).toHaveBeenCalledOnce()
  })

  it('does nothing when disabled', () => {
    render(<InBackdrop enabled={false} />)
    expect(isLensed()).toBe('false')
    expect(backdrop.track).not.toHaveBeenCalled()
    expect(backdrop.invalidate).not.toHaveBeenCalled()
  })

  it('stops when disabled or unmounted', () => {
    const { rerender, unmount } = render(<InBackdrop />)
    rerender(<InBackdrop enabled={false} />)
    expect(untrack).toHaveBeenCalledOnce()

    rerender(<InBackdrop />)
    unmount()
    expect(untrack).toHaveBeenCalledTimes(2)
  })
})
