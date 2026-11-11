import { cleanup, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackLight } from '../../shared/lightSource'
import { useEdgeLight } from './useEdgeLight'

// The light source is tested on its own; here only whether the element registers with it matters.
const untrack = vi.hoisted(() => vi.fn<() => void>())
vi.mock('../../shared/lightSource', () => ({ trackLight: vi.fn<typeof trackLight>(() => untrack) }))

function Host({ enabled = true, following = enabled }: { enabled?: boolean; following?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const edge = useEdgeLight(ref, enabled, following)
  return (
    <div ref={ref} data-testid="host" className={edge.className}>
      <p>Content</p>
      {edge.element}
    </div>
  )
}

function host() {
  return screen.getByTestId('host')
}

beforeEach(() => {
  vi.mocked(trackLight).mockClear()
  untrack.mockClear()
})

afterEach(cleanup)

describe('useEdgeLight', () => {
  it('adds the edge light class and its ring, after the content, only when enabled', () => {
    const { rerender } = render(<Host />)
    const ring = host().querySelector('.prism-edge-light__ring')!
    expect(host().classList.contains('prism-edge-light')).toBe(true)
    expect(host().lastElementChild).toBe(ring)
    expect(ring.getAttribute('aria-hidden')).toBe('true')

    rerender(<Host enabled={false} />)
    expect(host().classList.contains('prism-edge-light')).toBe(false)
    expect(host().querySelector('.prism-edge-light__ring')).toBeNull()
  })

  it('tracks the light on the host while enabled, as far as its own radius, and stops when unmounted', () => {
    const { unmount } = render(<Host />)
    expect(trackLight).toHaveBeenCalledExactlyOnceWith(host(), '--prism-edge-light-size')

    unmount()
    expect(untrack).toHaveBeenCalledOnce()
  })

  it('stops and restarts tracking as it is toggled', () => {
    const { rerender } = render(<Host />)
    rerender(<Host enabled={false} />)
    expect(untrack).toHaveBeenCalledOnce()

    rerender(<Host />)
    expect(trackLight).toHaveBeenCalledTimes(2)
  })

  it('keeps its ring but stops tracking while not following', () => {
    const { rerender } = render(<Host />)
    rerender(<Host following={false} />)

    expect(untrack).toHaveBeenCalledOnce()
    expect(host().querySelector('.prism-edge-light__ring')).not.toBeNull()
  })

  it('never tracks the light while disabled', () => {
    render(<Host enabled={false} />)
    expect(trackLight).not.toHaveBeenCalled()
  })
})
