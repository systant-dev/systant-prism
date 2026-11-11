import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useRim, type RimOptions } from './useRim'

function Host(options: RimOptions) {
  const { element } = useRim(options)
  return <div data-testid="host">{element}</div>
}

function rim() {
  return document.querySelector('[data-testid="host"] > .prism-rim')!
}

afterEach(cleanup)

describe('useRim', () => {
  it('renders a hidden, empty span that keeps still by default', () => {
    render(<Host />)
    expect([...rim().classList]).toEqual(['prism-rim'])
    expect(rim().getAttribute('aria-hidden')).toBe('true')
    expect(rim().textContent).toBe('')
  })

  it('turns while its host is pressed', () => {
    render(<Host turns />)
    expect([...rim().classList]).toEqual(['prism-rim', 'prism-rim--turns'])
  })
})
