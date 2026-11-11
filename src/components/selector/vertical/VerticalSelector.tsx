import { Selector, type SelectorItem, type SelectorProps } from '../core'
import { PrismStyles } from '../../../shared'
import { verticalSelectorStyles } from './VerticalSelector.styles'

export type VerticalSelectorItem<T extends string = string> = SelectorItem<T>

export type VerticalSelectorProps<T extends string = string> = SelectorProps<T>

// A list of entries to pick one from, stacked vertically. The entries are plain
// text, with no glass of their own; a single glass pill behind them rests on
// the selected entry and glides to whichever one the pointer is over, then back
// when it leaves. Pressing an entry sinks it and the pill under it into the
// surface, as a button sinks; while it is held, the pill stays on it. The
// behaviour is the shared selector's (src/components/selector/core); see
// VerticalSelector.styles.ts for the glide, the press and the glass.
//
// The arrow keys up and down, Home and End move the selection.
export function VerticalSelector<T extends string = string>(props: VerticalSelectorProps<T>) {
  return (
    <>
      <PrismStyles href="prism-vertical-selector" css={verticalSelectorStyles} />
      <Selector orientation="vertical" {...props} />
    </>
  )
}
