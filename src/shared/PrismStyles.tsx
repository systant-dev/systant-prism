import { use } from 'react'
import { StyleNonce } from './styleNonce'

/**
 * A component's stylesheet. React 19 hoists it into <head> and dedupes it by
 * href, so every instance can render it. It carries the page's nonce, where one
 * is given (StyleNonce), for a Content Security Policy that lets in only the
 * stylesheets that have it.
 */
export function PrismStyles({ href, css }: { href: string; css: string }) {
  const nonce = use(StyleNonce)
  return (
    <style href={href} precedence="prism" nonce={nonce}>
      {css}
    </style>
  )
}
