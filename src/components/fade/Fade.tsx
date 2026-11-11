import type { ComponentProps, Key } from 'react'
import { cx, motionStyles, PrismStyles } from '../../shared'
import { fadeStyles } from './fade.styles'
import { FadeLayer } from './FadeLayer'
import { useLayers, type FadeMode } from './useLayers'

export interface FadeProps extends ComponentProps<'div'> {
  /** What the content is. When it changes, the content fades to the new by `mode`. */
  contentKey: Key
  /** `layer` fades the old out and the new in as it goes; `background` fades the new in over the old. */
  mode?: FadeMode
}

// A box whose content fades from one to the next as it is replaced: give it a
// contentKey naming what it shows, and change both together. By `mode`:
//
// - layer (the default): the old content fades out quickly, and the new fades
//   in quickly as the old is nearly gone, so they barely show at once and the
//   box is never left empty. For a page beside a menu.
// - background: the new content fades in over the old, which stays under it
//   until covered, so one shows through into the other. For a background.
//
// Changes while it fades are followed, and the latest key always ends up
// showing. While the key stays the same, the content updates in place.
//
// Everything but the fade and its display (a grid of one cell, which the
// content fills) is a plain <div>'s. See useLayers for how layers come and go,
// and fade.styles.ts for how they look and their timing.
export function Fade({ contentKey, mode = 'layer', className, children, ...rest }: FadeProps) {
  const { layers, faded } = useLayers(contentKey, children, mode)

  return (
    <div className={cx('prism-fade', mode === 'background' && 'prism-fade--background', className)} {...rest}>
      <PrismStyles href="prism-motion" css={motionStyles} />
      <PrismStyles href="prism-fade" css={fadeStyles} />
      {layers.map((layer) => (
        <FadeLayer key={layer.id} state={layer.state} onFaded={() => faded(layer.id)}>
          {layer.content}
        </FadeLayer>
      ))}
    </div>
  )
}
