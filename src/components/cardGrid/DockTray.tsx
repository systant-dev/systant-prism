import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { useBackdropLens, useGlassText } from '../backdrop'
import { axes, entryForKey, horizontalSelectorStyles, Pill, useOptionRefs, usePillLayout } from '../selector'
import { cssVars, cx, motionStyles, PrismStyles, useHold } from '../../shared'

/** The selector its chips are entries of: their padding, idle opacity and press, and the hover's spring and fade. */
const SELECTOR = 'prism-horizontal-selector'

export interface DockTrayChip {
  id: string
  title: ReactNode
  /** Accessible name of the chip. */
  label: string
  /** Its card is being brought back: it fades out where it is, closing up as it goes. */
  going: boolean
  /** How wide it was as it started going, in px, for it to close up from. */
  width?: number
}

export interface DockTrayProps {
  chips: readonly DockTrayChip[]
  /** Accessible name of the tray. */
  label: string
  /** Brings a docked card back. */
  onRestore: (id: string) => void
  /** Shown faintly over the rail while it is empty, as where docked cards go. */
  placeholder?: ReactNode
  /** Kept up to date with the chips' elements, for the grid to focus or measure one. */
  chipsRef: RefObject<ReadonlyMap<string, HTMLButtonElement>>
  /** Shade the chips' text, where it must be, to stay readable over what is behind the tray. */
  readableText?: boolean
}

// The tray of a CardGrid's docked cards, above the grid: a horizontal selector's
// track (src/components/selector) as wide as the grid, with the docked cards'
// chips as its entries and nothing selected. It is that selector's glass
// capsule, tint, rim, glints and shadow, drawn by its stylesheet, and its
// entries' press and timing. The selector's hover pill lies under the chip the
// pointer is over and follows it from chip to chip on its spring, fading out as
// the pointer moves off the chips, onto the bare track or out of the tray. The
// chips abut, with no gap of bare track between them, so going from one to the
// next never puts the pill out. Each chip is a button that brings its card
// back; pressing one sinks it, and the pill under it, as a selector's entry
// sinks.
//
// It is a toolbar: one tab stop, and the arrow keys, Home and End move focus
// along it (the selector's navigation), Enter and Space press the focused chip.
//
// The tray spans the grid and is always there, as where docked cards go: a
// strut as tall as a chip keeps its height while it is empty, so docking the
// first card or bringing the last back never moves the grid, and a faint
// placeholder says what it is for, crossfading with the first chip to come and
// the last to go. Empty, it is hidden from assistive tech, as a toolbar with
// nothing in it. A chip fades in, opening out, as its card is docked, and fades
// out, closing up, as it is brought back (CardGrid.styles.ts); one going is
// inert, and the grid takes it out once it has. A tray too narrow for its chips
// scrolls them sideways, inside the capsule: they are in a scroller of their
// own within it, as the capsule's rim and glints would scroll away with them.
//
// On a GlassBackdrop's page its glass is drawn as the selector's track is, and
// its tint is no thinner than the page's text needs: the chips are in the page's
// one text colour, which is chosen to read on the page's glass, not on its image.
export function DockTray({ chips, label, placeholder, onRestore, chipsRef, readableText = true }: DockTrayProps) {
  const trayRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const { options, optionRef } = useOptionRefs<string, HTMLButtonElement>(chips.map((chip) => chip.id))
  const [hovered, setHovered] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const { held, hold, release } = useHold<string>()
  const textColor = useGlassText(
    trayRef,
    { property: `--${SELECTOR}-fg`, opacityProperty: `--${SELECTOR}-idle-opacity` },
    readableText,
  )
  useBackdropLens(trayRef)

  const docked = chips.filter((chip) => !chip.going)
  const items = docked.map((chip) => ({ value: chip.id, label: chip.title }))
  // Only under a chip still docked: one going takes the pill with it as it fades.
  const hover = docked.some((chip) => chip.id === hovered) ? hovered : null
  const tabStop = docked.some((chip) => chip.id === focused) ? focused : docked[0]?.id

  usePillLayout(
    trackRef,
    [{ ref: pillRef, target: hover, spring: `--${SELECTOR}-hover-glide-duration` }],
    options,
    axes.horizontal,
    `--${SELECTOR}`,
  )
  // Before the grid's own layout effect, which focuses a chip just docked.
  useLayoutEffect(() => {
    chipsRef.current = options
  })

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const at = items.findIndex((item) => options.get(item.value) === document.activeElement)
    // Enter and Space are the focused button's own.
    if (event.key === 'Enter' || event.key === ' ') return
    const next = entryForKey(items, at, event.key, axes.horizontal.steps(rtl))
    if (!next) return
    event.preventDefault()
    setHovered(null)
    options.get(next.value)?.focus()
  }

  return (
    <>
      <PrismStyles href="prism-motion" css={motionStyles} />
      <PrismStyles href={SELECTOR} css={horizontalSelectorStyles} />
      <div
        ref={trayRef}
        role="toolbar"
        aria-label={label}
        aria-hidden={docked.length === 0 || undefined}
        inert={docked.length === 0}
        className={cx(SELECTOR, 'prism-card-grid__tray', docked.length === 0 && 'prism-card-grid__tray--empty')}
        style={textColor ? cssVars({ [`--_${SELECTOR}-fg`]: textColor }) : undefined}
        onKeyDown={handleKeyDown}
        onPointerLeave={() => {
          setHovered(null)
          release()
        }}
      >
        <div
          ref={trackRef}
          className="prism-card-grid__tray-track"
          // Over the track itself, past the chips or round them, lights none:
          // the chips' moves bubble here too, but come from a chip.
          onPointerMove={(event) => {
            if (event.target !== event.currentTarget || held !== null) return
            setHovered(null)
          }}
        >
          {/* A selector's hover pill, and the only pill: no chip is selected */}
          <Pill
            pillRef={pillRef}
            className={cx(
              `${SELECTOR}__indicator`,
              `${SELECTOR}__indicator--hover`,
              hover !== null && `${SELECTOR}__indicator--shown`,
            )}
            shown={hover !== null}
            pressed={hover !== null && held === hover}
          />
          {placeholder != null && placeholder !== '' && (
            <span className={`${SELECTOR}__option prism-card-grid__tray-placeholder`} aria-hidden="true">
              {placeholder}
            </span>
          )}
          {/* As tall as a chip, so the tray keeps its height with none in it */}
          <span className={`${SELECTOR}__option prism-card-grid__tray-strut`} aria-hidden="true">
            {' '}
          </span>
          {chips.map(({ id, title, label: name, going, width }) => (
            <button
              key={id}
              ref={optionRef(id)}
              type="button"
              className={cx(
                `${SELECTOR}__option`,
                'prism-press',
                'prism-card-grid__chip',
                going && 'prism-card-grid__chip--leaving',
                id === hover && `${SELECTOR}__option--hovered`,
              )}
              style={going && width ? cssVars({ '--prism-card-grid-chip-width': `${width}px` }) : undefined}
              aria-label={name}
              aria-hidden={going || undefined}
              inert={going}
              tabIndex={id === tabStop ? 0 : -1}
              onFocus={() => setFocused(id)}
              // Moves, not enters: a chip that slides under a still pointer gets no pointerenter.
              onPointerMove={(event) => {
                if (event.pointerType === 'touch' || going || id === hovered) return
                // While a chip is held, the pill stays under it, as the chip stays pressed.
                if (held !== null && held !== id) return
                setHovered(id)
              }}
              onPointerDown={(event) => {
                if (event.button === 0 && !going) hold(id)
              }}
              onClick={() => onRestore(id)}
            >
              {title}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
