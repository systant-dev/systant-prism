import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react'
import { cx } from '../../shared'
import { afterFade } from './afterFade'
import type { Layer } from './useLayers'

export interface FadeLayerProps {
  state: Layer['state']
  /** Called once it has faded in or out. */
  onFaded(): void
  children: ReactNode
}

/** One layer of a Fade: its content, fading by its state (fade.styles.ts), and inert while it isn't current. */
export function FadeLayer({ state, onFaded, children }: FadeLayerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const faded = useEffectEvent(onFaded)

  useEffect(() => {
    if ((state === 'in' || state === 'out') && ref.current) return afterFade(ref.current, faded)
  }, [state])

  return (
    <div
      ref={ref}
      className={cx('prism-fade__layer', state !== 'shown' && `prism-fade__layer--${state}`)}
      inert={state === 'out' || state === 'under'}
    >
      {children}
    </div>
  )
}
