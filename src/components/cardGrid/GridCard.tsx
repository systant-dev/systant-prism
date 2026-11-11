import {
  memo,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { Card, type CardPadding } from '../card'
import { cssVars, cx, Glyph } from '../../shared'
import type { Rect } from './layout'

/**
 * What a card asks of its grid. The grid hands every card the same object for
 * as long as it is mounted, so handing it on never re-renders one.
 */
export interface GridCardActions {
  /** Keeps the card's element while it is mounted; returns the function that lets it go. */
  card(id: string, el: HTMLDivElement): () => void
  /** The same, for its title. */
  title(id: string, el: HTMLSpanElement): () => void
  headerPointerDown(event: ReactPointerEvent, id: string): void
  toggleMaximised(id: string): void
  titleKeyDown(event: ReactKeyboardEvent, id: string): void
  minimise(id: string): void
}

export interface GridCardProps {
  id: string
  title: ReactNode
  label: string
  minimiseLabel: string
  maximiseLabel: string
  content: ReactNode
  padding: CardPadding
  /** In the grid: neither docked nor hidden behind one filling it. */
  shown: boolean
  /** Where it is pinned while it fades out of the grid, if it is. */
  pinned: Rect | undefined
  maximised: boolean
  dragging: boolean
  /** Under the dragged card, so bending nothing behind it. */
  unbent: boolean
  readableText: boolean
  actions: GridCardActions
}

/**
 * A card under the dragged one keeps its blur but bends nothing, so the glass
 * on top doesn't lie over a pane already bent.
 */
const UNBENT = cssVars({ '--prism-refraction': '0%' })

const minimiseIcon = (
  <Glyph size={11}>
    <path d="M3 10.5h8" />
  </Glyph>
)

const maximiseIcon = (
  <Glyph size={11}>
    <rect x="2.5" y="2.5" width="9" height="9" rx="1.5" />
  </Glyph>
)

const restoreIcon = (
  <Glyph size={11}>
    <rect x="2" y="4.5" width="7.5" height="7.5" rx="1.5" />
    <path d="M4.5 2h6A1.5 1.5 0 0 1 12 3.5v6" />
  </Glyph>
)

// One card of a CardGrid: its header (the title, which the arrow keys move it
// by and Enter or Space maximise it by, and the minimise and maximise buttons)
// and its content. It is memoised,
// so the grid re-rendering (as a card is dragged past another, or comes under
// the dragged one) re-renders only the cards whose own state changed: each one
// re-rendered reads its CSS afresh, and inside a GlassBackdrop has every glass
// element re-measured.
export const GridCard = memo(function GridCard({
  id,
  title,
  label,
  minimiseLabel,
  maximiseLabel,
  content,
  padding,
  shown,
  pinned,
  maximised,
  dragging,
  unbent,
  readableText,
  actions,
}: GridCardProps) {
  const cardRef = useCallback((el: HTMLDivElement | null) => (el ? actions.card(id, el) : undefined), [actions, id])
  const titleRef = useCallback((el: HTMLSpanElement | null) => (el ? actions.title(id, el) : undefined), [actions, id])

  return (
    <Card
      ref={cardRef}
      role="group"
      aria-label={label}
      padding="none"
      inert={!shown}
      readableText={readableText}
      className={cx(
        'prism-card-grid__card',
        maximised && 'prism-card-grid__card--maximised',
        dragging && 'prism-card-grid__card--dragging',
        pinned && 'prism-card-grid__card--leaving',
        !shown && !pinned && 'prism-card-grid__card--hidden',
      )}
      style={
        pinned || unbent
          ? { ...(pinned && { position: 'absolute', margin: 0, ...pinned }), ...(unbent && UNBENT) }
          : undefined
      }
    >
      {/* One element, so it can be kept its own size as the card glides between sizes (motion.ts) */}
      <div className="prism-card-grid__content">
        <div
          className="prism-card-grid__header"
          onPointerDown={(event) => actions.headerPointerDown(event, id)}
          onDoubleClick={(event) => {
            if (!(event.target as Element).closest('button')) actions.toggleMaximised(id)
          }}
        >
          <span
            ref={titleRef}
            className="prism-card-grid__title"
            role="button"
            tabIndex={0}
            aria-roledescription="movable card title"
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
            onKeyDown={(event) => actions.titleKeyDown(event, id)}
          >
            {title}
          </span>
          <button
            type="button"
            className="prism-card-grid__control"
            aria-label={minimiseLabel}
            onClick={() => actions.minimise(id)}
          >
            {minimiseIcon}
          </button>
          <button
            type="button"
            className="prism-card-grid__control"
            aria-label={maximiseLabel}
            aria-pressed={maximised}
            onClick={() => actions.toggleMaximised(id)}
          >
            {maximised ? restoreIcon : maximiseIcon}
          </button>
        </div>
        <div className={`prism-card-grid__body prism-card-grid__body--pad-${padding} prism-scrollbar`}>{content}</div>
      </div>
    </Card>
  )
})
