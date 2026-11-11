import type { ReactNode } from 'react'

export interface GlyphProps {
  /** How wide and high it is drawn, in px. Default 14. */
  size?: number
  /** How thick its lines are, on its 14-unit grid. Default 1.75. */
  strokeWidth?: number
  className?: string
  /** Its lines, on a grid of 14 by 14. */
  children: ReactNode
}

/** A line drawing in the text's colour, on a grid of 14: the icons of prism's controls. */
export function Glyph({ size = 14, strokeWidth = 1.75, className, children }: GlyphProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** A tick, for what is chosen. */
export function Tick({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M2.5 7.5l3 3 6-7" />
    </Glyph>
  )
}

/** How big an icon is drawn and any class of its own: a Glyph's own, but for its lines. */
export type IconProps = Omit<GlyphProps, 'children' | 'strokeWidth'>

/** A cross, for clearing, cancelling and closing. */
export function Cross(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" />
    </Glyph>
  )
}

/** How far a chevron turns, clockwise, from pointing right. */
const TURNS = { right: 0, down: 90, left: 180 } as const

/**
 * A chevron, pointing right unless `point` says: to a submenu, the next page or
 * month, or down to a list that opens. Turned in place rather than redrawn, so
 * each way is the same shape.
 */
export function Chevron({ point = 'right', ...props }: IconProps & { point?: keyof typeof TURNS }) {
  const turn = TURNS[point]
  return (
    <Glyph {...props}>
      <path d="M5 2.5l4.5 4.5L5 11.5" transform={turn ? `rotate(${turn} 7 7)` : undefined} />
    </Glyph>
  )
}
