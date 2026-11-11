import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef, type CSSProperties } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeBackdrop } from '../../../test/selector'
import { BackdropContext } from '../backdrop'
import { Card, type CardPadding } from './Card'

function card() {
  return screen.getByTestId('card')
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Card', () => {
  it('renders its children in a glass card with every effect on by default', () => {
    render(<Card data-testid="card">Hello</Card>)

    expect(card().textContent).toBe('Hello')
    expect([...card().classList]).toEqual(['prism-card', 'prism-card--pad-md', 'prism-edge-light', 'prism-inner-sheen'])
  })

  it.each<CardPadding>(['none', 'sm', 'md', 'lg'])('pads with padding="%s"', (padding) => {
    render(<Card data-testid="card" padding={padding} />)
    expect(card().classList.contains(`prism-card--pad-${padding}`)).toBe(true)
  })

  it('adds its own className after the library classes', () => {
    render(<Card data-testid="card" className="mine" />)
    expect([...card().classList].at(-1)).toBe('mine')
  })

  it.each([
    ['highlight', 'prism-edge-light'],
    ['innerSheen', 'prism-inner-sheen'],
  ])('turns %s off', (prop, className) => {
    render(<Card data-testid="card" {...{ [prop]: false }} />)
    expect(card().classList.contains(className)).toBe(false)
    expect(card().classList.contains('prism-card')).toBe(true)
  })

  it('passes other div props through', () => {
    const onClick = vi.fn<() => void>()
    render(<Card data-testid="card" id="c1" role="region" aria-label="Summary" onClick={onClick} />)

    expect(card().id).toBe('c1')
    expect(card().getAttribute('role')).toBe('region')
    expect(card().getAttribute('aria-label')).toBe('Summary')
    fireEvent.click(card())
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies its style prop', () => {
    render(<Card data-testid="card" style={{ color: 'red', '--prism-card-radius': '4px' } as CSSProperties} />)

    expect(card().style.color).toBe('red')
    expect(card().style.getPropertyValue('--prism-card-radius')).toBe('4px')
  })

  it('has a backdrop draw its glass, unless turned off', () => {
    const { backdrop } = fakeBackdrop()
    const { rerender } = render(
      <BackdropContext value={backdrop}>
        <Card data-testid="card" />
      </BackdropContext>,
    )
    expect(backdrop.track).toHaveBeenCalledExactlyOnceWith(card())

    backdrop.track.mockClear()
    rerender(
      <BackdropContext value={backdrop}>
        <Card data-testid="card" refract={false} />
      </BackdropContext>,
    )
    expect(backdrop.track).not.toHaveBeenCalled()
  })

  it('forwards its element to a ref object', () => {
    const ref = createRef<HTMLDivElement>()
    render(<Card data-testid="card" ref={ref} />)
    expect(ref.current).toBe(card())
  })
})
