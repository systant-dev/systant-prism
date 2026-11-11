import { Glyph } from '../../shared'

/** A chevron or two for a button in a calendar's header, drawn by `d`. */
export function CalendarArrow({ d }: { d: string }) {
  return (
    <Glyph>
      <path d={d} />
    </Glyph>
  )
}
