import { useRef, useState, type ComponentProps, type KeyboardEvent } from 'react'
import { useBackdropLens, useGlassText } from '../../backdrop'
import { cornerStyles, cssVars, cx, motionStyles, PrismStyles, useForwardedRef, useHold } from '../../../shared'
import { entryForKey, firstEnabled, type SelectorItem } from './navigation'
import { axes, type Orientation } from './orientation'
import { Pill } from './Pill'
import { useEntrance } from './useEntrance'
import { useLanding } from './useLanding'
import { useOptionRefs } from './useOptionRefs'
import { usePillLayout } from './usePillLayout'

export type { SelectorItem }

export interface SelectorProps<T extends string = string> extends Omit<ComponentProps<'div'>, 'onChange' | 'children'> {
  items: readonly SelectorItem<T>[]
  /** The selected item's value; none is selected while it matches no item. */
  value?: T
  onChange?: (value: T) => void
  /** Blur what is behind the glass and bend it at its edges. */
  refract?: boolean
  /** Give the entries the page's text colour inside a GlassBackdrop, and keep them readable on an opaque background. */
  readableText?: boolean
}

interface SelectorLayout {
  orientation: Orientation
  /** The list is itself glass, the track the pills slide along. */
  glassTrack?: boolean
}

// What VerticalSelector and HorizontalSelector share: a list of entries to pick
// one from, laid out along `orientation`. The entries are plain text, with no
// glass of their own. Two pills sit behind them. The glass pill marks the
// selection: it stays on the selected entry, and glides to a newly selected
// one. A dimmer hover pill, a tint with no glass, follows the pointer, gliding
// from entry to entry on a spring, so it carries its speed from one entry on to
// the next, and fades out where it leaves the list. It glides under the
// selected entry too, so it slides out from under the glass pill rather than
// jumping past it, but hides while it is there, as the selection is already
// marked. Pressing an entry sinks it and the pill on it into the surface, as a
// button sinks, through the shared press (src/effects/press); while it is held,
// the hover pill stays on it.
//
// A mouse or pen selects as it presses, as tabs do, rather than on letting go.
// The glass pill sets off for the entry as the press begins and arrives
// already sunk, then settles back in place once it has landed and been let go,
// while the hover pill fades out beneath it: one movement on one pill. It
// stays sunk until it lands however quick the click (useLanding.ts), so it
// never settles in mid-flight. Selecting on the click instead would sink the
// hover pill, then send the glass pill across while the hover pill was still
// settling. A touch selects on the click, as it lifts, so a swipe that starts
// on the list still scrolls the page.
//
// Mounting as the page first loads, it holds the glass pill back until the
// page has settled, and then fades it in (useEntrance.ts), so the pill doesn't
// show while its glass is still getting going. Its classes say which phase
// the entrance is in: prism-<orientation>-selector--waiting, then --appearing.
//
// With `glassTrack` the list is itself a glass pill, the track the pills slide
// along; without, it sits on whatever it is put on. selector.styles.ts styles
// what the selectors share, and each selector its own look; usePillLayout.ts
// places the pills. Its classes are prism-<orientation>-selector and its parts.
//
// Inside a GlassBackdrop its entries are the page's one text colour (useGlassText,
// src/components/backdrop), through --_prism-<orientation>-selector-fg, which its
// styles prefer. Elsewhere they keep its --prism-<orientation>-selector-fg, or,
// where that is unset, the colour it inherits.
//
// It is a listbox: one tab stop, on the selected entry, and the arrow keys
// along it (navigation.ts), Home and End move the selection, skipping disabled
// entries. Across a list whose text runs right to left, the arrows follow it.
// Selection follows focus, as in a radio group, so it suits picking what a
// page shows. A disabled entry takes no focus from a click. A touch has no
// hover, so it only ever selects.
export function Selector<T extends string = string>({
  orientation,
  glassTrack = false,
  items,
  value,
  onChange,
  refract = true,
  readableText = true,
  className,
  style,
  onKeyDown,
  onPointerLeave,
  ref,
  ...rest
}: SelectorProps<T> & SelectorLayout) {
  const base = `prism-${orientation}-selector`
  const axis = axes[orientation]
  const innerRef = useForwardedRef(ref)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const hoverRef = useRef<HTMLSpanElement>(null)
  const { options, optionRef } = useOptionRefs(items.map((item) => item.value))
  const [hovered, setHovered] = useState<T | null>(null)
  const { held, hold, release } = useHold<T>()
  // The entry a mouse or pen press has just selected, whose click is then left
  // alone: selecting again on it would call onChange twice for one click, when
  // the value follows onChange a render or more later (a router, a transition).
  const pressSelected = useRef<T | null>(null)

  const selected = items.find((item) => item.value === value)
  const shown = selected !== undefined
  // Hidden on the selected entry, which the glass pill already marks.
  const hoverShown = hovered !== null && hovered !== selected?.value

  useBackdropLens(innerRef, refract && glassTrack)
  const textColor = useGlassText(
    innerRef,
    { property: `--${base}-fg`, opacityProperty: `--${base}-idle-opacity` },
    readableText,
  )
  usePillLayout(
    innerRef,
    [
      { ref: indicatorRef, target: selected?.value ?? null },
      { ref: hoverRef, target: hovered, spring: `--${base}-hover-glide-duration` },
    ],
    options,
    axis,
    `--${base}`,
  )
  // After usePillLayout, so it finds the glide the new place starts.
  const { landing, land } = useLanding(indicatorRef, selected?.value ?? null)
  const entrance = useEntrance(innerRef, indicatorRef, shown)

  // The one tab stop: the selected entry, else the first that can be picked.
  const tabStop = selected && !selected.disabled ? selected.value : firstEnabled(items)?.value

  // `focus` is false for a press, which the browser focuses itself just after.
  // Focusing it here, before the browser has seen the mouse, would read as
  // focus from a script, which shows the keyboard's focus ring.
  function select(item: SelectorItem<T>, focus = true) {
    if (item.disabled) return
    if (focus) options.get(item.value)?.focus()
    if (item.value !== value) onChange?.(item.value)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // A click from here on comes from the keyboard or assistive tech, not a press.
    pressSelected.current = null
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const at = items.findIndex((item) => options.get(item.value) === document.activeElement)
    const next = entryForKey(items, at, event.key, axis.steps(rtl))
    if (!next) return
    event.preventDefault()
    // The keyboard takes over from the pointer, so the hover pill goes.
    setHovered(null)
    select(next)
  }

  return (
    <>
      <PrismStyles href="prism-corners" css={cornerStyles} />
      <PrismStyles href="prism-motion" css={motionStyles} />
      <div
        ref={innerRef}
        role="listbox"
        aria-orientation={orientation}
        className={cx(base, entrance && `${base}--${entrance}`, className)}
        style={{
          ...(textColor && cssVars({ [`--_${base}-fg`]: textColor })),
          ...style,
        }}
        onKeyDown={handleKeyDown}
        onPointerLeave={(event) => {
          onPointerLeave?.(event)
          setHovered(null)
          release()
        }}
        {...rest}
      >
        {/* The pills first, so the entries paint over them, and the glass pill over the hover pill */}
        <Pill
          pillRef={hoverRef}
          className={cx(`${base}__indicator`, `${base}__indicator--hover`, hoverShown && `${base}__indicator--shown`)}
          shown={hoverShown}
          pressed={hoverShown && held === hovered}
        />
        <Pill
          pillRef={indicatorRef}
          className={cx(`${base}__indicator`, shown && `${base}__indicator--shown`)}
          shown={shown}
          // Through the entry it sits on, and until it lands on one a press selected.
          pressed={selected !== undefined && (held === selected.value || landing === selected.value)}
          refract={refract}
        />
        {items.map((item) => (
          <div
            key={item.value}
            ref={optionRef(item.value)}
            role="option"
            aria-selected={item.value === value}
            aria-disabled={item.disabled || undefined}
            tabIndex={item.value === tabStop ? 0 : -1}
            // The entries press themselves (:active).
            className={cx(`${base}__option`, 'prism-press', item.value === hovered && `${base}__option--hovered`)}
            // Moves, not enters: an entry that appears under a still pointer gets no pointerenter.
            onPointerMove={(event) => {
              if (event.pointerType === 'touch' || item.disabled || item.value === hovered) return
              // While an entry is held, the hover pill stays on it, as the entry stays pressed.
              if (held !== null && held !== item.value) return
              setHovered(item.value)
            }}
            onPointerDown={(event) => {
              pressSelected.current = null
              if (event.button !== 0 || item.disabled) return
              hold(item.value)
              if (event.pointerType === 'touch') return
              if (item.value !== value) land(item.value)
              select(item, false)
              pressSelected.current = item.value
            }}
            onMouseDown={(event) => {
              if (item.disabled) event.preventDefault()
            }}
            onClick={() => {
              const pressed = pressSelected.current === item.value
              pressSelected.current = null
              if (!pressed) select(item)
            }}
          >
            {item.label}
          </div>
        ))}
      </div>
    </>
  )
}
