import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeBackdrop } from '../../../test/selector'
import { BackdropContext } from '../backdrop'
import { Button } from './Button'

function button() {
  return screen.getByRole('button')
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Button', () => {
  it('renders its children in a blurring glass button', () => {
    render(<Button>Save</Button>)

    expect(button().textContent).toBe('Save')
    expect([...button().classList]).toEqual(['prism-button', 'prism-button--primary', 'prism-press', 'prism-glare'])
    expect(button().querySelector('.prism-glare__light')).not.toBeNull()
  })

  it('takes the secondary variant', () => {
    render(<Button variant="secondary">Cancel</Button>)
    expect(button().classList.contains('prism-button--secondary')).toBe(true)
    expect(button().classList.contains('prism-button--primary')).toBe(false)
  })

  it('draws its drop shadows from a hidden span after the content', () => {
    render(
      <Button>
        <svg data-testid="icon" />
        Save
      </Button>,
    )
    const shadow = button().querySelector('.prism-press__shadow')!
    expect(shadow.getAttribute('aria-hidden')).toBe('true')
    // The label's first element stays its :first-child.
    expect(button().firstElementChild).toBe(screen.getByTestId('icon'))
  })

  it('draws its state tint from a hidden span', () => {
    render(<Button>Save</Button>)
    const tint = button().querySelector('.prism-button__tint')!
    expect(tint.getAttribute('aria-hidden')).toBe('true')
    expect(tint.textContent).toBe('')
  })

  it('draws its rim from a hidden span, the shared rim that turns while pressed', () => {
    render(<Button>Save</Button>)
    const rim = button().querySelector('.prism-rim')!
    expect(rim.classList.contains('prism-rim--turns')).toBe(true)
    expect(rim.getAttribute('aria-hidden')).toBe('true')
    expect(rim.textContent).toBe('')
  })

  it('turns the glare off', () => {
    render(<Button glare={false} />)
    expect(button().classList.contains('prism-glare')).toBe(false)
    expect(button().querySelector('.prism-glare__light')).toBeNull()
  })

  it('has no glare while disabled', () => {
    const { rerender } = render(<Button disabled />)
    expect(button().classList.contains('prism-glare')).toBe(false)

    rerender(<Button />)
    expect(button().classList.contains('prism-glare')).toBe(true)
  })

  it('has a backdrop draw its glass, unless turned off', () => {
    const { backdrop } = fakeBackdrop()
    const { rerender } = render(
      <BackdropContext value={backdrop}>
        <Button />
      </BackdropContext>,
    )
    expect(backdrop.track).toHaveBeenCalledExactlyOnceWith(button())

    backdrop.track.mockClear()
    rerender(
      <BackdropContext value={backdrop}>
        <Button blur={false} />
      </BackdropContext>,
    )
    expect(backdrop.track).not.toHaveBeenCalled()
  })

  it('shares the corner tokens with the card', () => {
    render(<Button />)
    expect(document.querySelector('style[data-href="prism-corners"]')).not.toBeNull()
  })

  it('never submits a form by default', () => {
    render(<Button />)
    expect(button().getAttribute('type')).toBe('button')
  })

  it('takes another type', () => {
    render(<Button type="submit" />)
    expect(button().getAttribute('type')).toBe('submit')
  })

  it('adds its own className after the library class', () => {
    render(<Button className="mine" />)
    expect([...button().classList].at(-1)).toBe('mine')
  })

  it('passes other button props through', () => {
    const onClick = vi.fn<() => void>()
    render(<Button id="b1" aria-pressed="true" style={{ color: 'red' }} onClick={onClick} />)

    expect(button().id).toBe('b1')
    expect(button().getAttribute('aria-pressed')).toBe('true')
    expect(button().style.color).toBe('red')
    fireEvent.click(button())
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn<() => void>()
    render(<Button disabled onClick={onClick} />)

    fireEvent.click(button())
    expect(onClick).not.toHaveBeenCalled()
  })

  it('forwards its element to a ref object', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref} />)
    expect(ref.current).toBe(button())
  })
})
