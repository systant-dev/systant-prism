import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { usePress, type PressOptions } from './usePress'

function Pressable(props: PressOptions) {
  const press = usePress(props)
  return (
    <div data-testid="host" className={press.className}>
      Label
      {press.element}
    </div>
  )
}

function host() {
  return screen.getByTestId('host')
}

afterEach(cleanup)

describe('usePress', () => {
  it('marks the host and draws its shadow from a hidden span after the content', () => {
    render(<Pressable />)
    expect(host().className).toBe('prism-press')
    const shadow = host().querySelector('.prism-press__shadow')!
    expect(shadow.getAttribute('aria-hidden')).toBe('true')
    expect(host().firstChild!.textContent).toBe('Label')
  })

  it('adds no tint unless asked', () => {
    render(<Pressable />)
    expect(host().querySelector('.prism-press__tint')).toBeNull()
  })

  it('darkens the glass with a hidden tint layer', () => {
    render(<Pressable tint />)
    expect(host().querySelector('.prism-press__tint')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('presses the host through another element', () => {
    const { rerender } = render(<Pressable pressed />)
    expect(host().className).toBe('prism-press prism-press--pressed')
    rerender(<Pressable />)
    expect(host().className).toBe('prism-press')
  })
})
