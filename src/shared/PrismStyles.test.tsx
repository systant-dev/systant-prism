import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PrismStyles } from './PrismStyles'
import { StyleNonce } from './styleNonce'

afterEach(() => {
  cleanup()
  document.head.querySelectorAll('style[data-href^="prism-test"]').forEach((style) => style.remove())
})

const sheet = (href: string) => document.head.querySelector<HTMLStyleElement>(`style[data-href="${href}"]`)

describe('PrismStyles', () => {
  it('puts its stylesheet in the head, once however many render it', () => {
    render(
      <>
        <PrismStyles href="prism-test-once" css=".a{color:red}" />
        <PrismStyles href="prism-test-once" css=".a{color:red}" />
      </>,
    )
    expect(document.head.querySelectorAll('style[data-href="prism-test-once"]')).toHaveLength(1)
    expect(sheet('prism-test-once')?.textContent).toBe('.a{color:red}')
    expect(sheet('prism-test-once')?.hasAttribute('nonce')).toBe(false)
  })

  it("carries the page's nonce where one is given", () => {
    render(
      <StyleNonce value="r4nd0m">
        <PrismStyles href="prism-test-nonce" css=".b{color:red}" />
      </StyleNonce>,
    )
    expect(sheet('prism-test-nonce')?.nonce).toBe('r4nd0m')
  })
})
