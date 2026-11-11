import { createContext } from 'react'

/**
 * The nonce a page's Content Security Policy asks of its stylesheets, if it asks for
 * one: every stylesheet the library adds to the page carries it. Given as a provider
 * round the components, `<StyleNonce value={nonce}>`.
 */
export const StyleNonce = createContext<string | undefined>(undefined)
