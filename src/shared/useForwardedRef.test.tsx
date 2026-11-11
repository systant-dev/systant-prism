import { cleanup, render, screen } from '@testing-library/react'
import { createRef, useEffect, type Ref } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useForwardedRef } from './useForwardedRef'

afterEach(cleanup)

// Uses its own ref to the element, as a component does, and hands `ref` on.
function Host({ ref, seen }: { ref?: Ref<HTMLDivElement>; seen?: (el: HTMLDivElement | null) => void }) {
  const inner = useForwardedRef(ref)
  useEffect(() => seen?.(inner.current))
  return <div ref={inner} data-testid="host" />
}

describe('useForwardedRef', () => {
  it('gives the component its own ref to the element, without one given', () => {
    const seen = vi.fn<(el: HTMLDivElement | null) => void>()
    render(<Host seen={seen} />)
    expect(seen).toHaveBeenCalledWith(screen.getByTestId('host'))
  })

  it('hands the element to a ref object', () => {
    const ref = createRef<HTMLDivElement>()
    render(<Host ref={ref} />)
    expect(ref.current).toBe(screen.getByTestId('host'))
  })

  it('hands the element to a callback ref, and runs its cleanup on unmount', () => {
    const cleanupRef = vi.fn<() => void>()
    const ref = vi.fn<(el: HTMLDivElement | null) => () => void>(() => cleanupRef)
    const { unmount } = render(<Host ref={ref} />)
    expect(ref).toHaveBeenCalledExactlyOnceWith(screen.getByTestId('host'))

    unmount()
    expect(cleanupRef).toHaveBeenCalledOnce()
    expect(ref).not.toHaveBeenCalledWith(null)
  })
})
