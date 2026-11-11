import type { CSSProperties } from 'react'

/**
 * Custom properties as a style: React's CSSProperties has no room for them, and this
 * is the one place that says they are one, rather than a cast wherever any is set. One
 * left undefined is not set.
 */
export function cssVars(vars: Readonly<Record<`--${string}`, string | number | undefined>>): CSSProperties {
  return vars as CSSProperties
}
