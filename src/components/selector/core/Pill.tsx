import type { RefObject } from 'react'
import { useBackdropLens } from '../../backdrop'
import { usePress } from '../../../effects/press'
import { cx } from '../../../shared'

export interface PillProps {
  pillRef: RefObject<HTMLSpanElement | null>
  className: string | undefined
  /** It is showing, so its glass is drawn. */
  shown: boolean
  /** Sunk, through the entry it sits on. */
  pressed: boolean
  /** Glass: blur what is behind it and bend it at its edges. */
  refract?: boolean
}

/**
 * One of a selector's pills: a span behind the entries that usePillLayout
 * places, with the shared press and, with `refract`, glass, which a
 * GlassBackdrop draws while it shows.
 */
export function Pill({ pillRef, className, shown, pressed, refract = false }: PillProps) {
  useBackdropLens(pillRef, refract && shown)
  const press = usePress({ pressed, tint: true })
  return (
    <span ref={pillRef} className={cx(className, press.className)} aria-hidden="true">
      {press.element}
    </span>
  )
}
