import { Selector, type SelectorItem, type SelectorProps } from '../core'
import { PrismStyles } from '../../../shared'
import { horizontalSelectorStyles } from './HorizontalSelector.styles'

export type HorizontalSelectorItem<T extends string = string> = SelectorItem<T>

export type HorizontalSelectorProps<T extends string = string> = SelectorProps<T>

// A row of entries to pick one from, inside a single glass pill. The entries
// are plain text; a brighter glass pill behind them rests on the selected entry
// and slides to whichever one the pointer is over, then back when it leaves.
// Pressing an entry sinks it and the pill under it into the surface, as a
// button sinks; while it is held, the pill stays on it. The behaviour is the
// shared selector's (src/components/selector/core); see
// HorizontalSelector.styles.ts for the track, the slide, the press and the
// glass.
//
// The arrow keys left and right, Home and End move the selection.
export function HorizontalSelector<T extends string = string>(props: HorizontalSelectorProps<T>) {
  return (
    <>
      <PrismStyles href="prism-horizontal-selector" css={horizontalSelectorStyles} />
      <Selector orientation="horizontal" glassTrack {...props} />
    </>
  )
}
