import { cleanup, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualFrames, placeAt, pointer } from '../../../test/dom'
import { useGlare } from './useGlare'

function Host({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const glare = useGlare(ref, enabled)
  return (
    <div ref={ref} data-testid="host" className={glare.className}>
      <p>Content</p>
      {glare.element}
    </div>
  )
}

function host() {
  return screen.getByTestId('host')
}

function light() {
  return host().querySelector<HTMLElement>('.prism-glare__light')!
}

function glareAt() {
  return [light().style.getPropertyValue('--prism-glare-x'), light().style.getPropertyValue('--prism-glare-y')]
}

let frames: ReturnType<typeof manualFrames>

beforeEach(() => {
  frames = manualFrames()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useGlare', () => {
  it('adds the glare class and its light, after the content, only when enabled', () => {
    const { rerender } = render(<Host />)
    expect(host().classList.contains('prism-glare')).toBe(true)
    expect(host().lastElementChild).toBe(light())
    expect(light().getAttribute('aria-hidden')).toBe('true')

    rerender(<Host enabled={false} />)
    expect(host().classList.contains('prism-glare')).toBe(false)
    expect(host().querySelector('.prism-glare__light')).toBeNull()
  })

  it('places the glare at the pointer, relative to the padding box, on the light alone', () => {
    render(<Host />)
    placeAt(host(), 100, 50, 200, 100)
    Object.defineProperty(host(), 'clientLeft', { value: 2 })
    Object.defineProperty(host(), 'clientTop', { value: 3 })

    pointer(host(), 'pointermove', 150, 90)
    frames.flush()

    expect(glareAt()).toEqual(['48px', '37px'])
    expect(host().style.getPropertyValue('--prism-glare-x')).toBe('')
  })

  it('ignores touches, which have no hover to show it', () => {
    render(<Host />)
    placeAt(host(), 0, 0)
    const touch = new MouseEvent('pointermove', { clientX: 10, clientY: 10, bubbles: true })
    host().dispatchEvent(Object.assign(touch, { pointerType: 'touch' }))

    expect(frames.pending).toBe(0)
  })

  it('stops tracking when disabled', () => {
    const { rerender } = render(<Host />)
    rerender(<Host enabled={false} />)

    pointer(host(), 'pointermove', 10, 10)
    expect(frames.pending).toBe(0)
  })
})
