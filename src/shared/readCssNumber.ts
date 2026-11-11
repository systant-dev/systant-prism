/**
 * The leading number of a computed CSS value (`16px` → 16), or `fallback` if
 * there isn't one. A length is only in px if its custom property is registered
 * (@property): unregistered, `1rem` reads as 1.
 */
export function readCssNumber(computed: CSSStyleDeclaration, property: string, fallback: number) {
  const value = parseFloat(computed.getPropertyValue(property))
  return Number.isFinite(value) ? value : fallback
}
