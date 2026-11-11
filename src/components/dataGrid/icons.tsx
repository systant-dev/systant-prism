import type { ComponentProps, ReactNode } from 'react'
import { Glyph } from '../../shared'

// The grid's own icons; its chevron and cross are prism's (../../shared/Glyph.tsx).

export const SortArrow = () => (
  <Glyph size={12}>
    <path d="M7 11.5v-9M3.5 6L7 2.5 10.5 6" />
  </Glyph>
)

export const Pencil = () => (
  <Glyph>
    <path d="M9.5 2.5l2 2-7 7H2.5v-2z" />
  </Glyph>
)

export const Bin = () => (
  <Glyph>
    <path d="M2.5 4h9M5.5 4V2.5h3V4M3.5 4l.5 7.5h6l.5-7.5" />
  </Glyph>
)

/** A funnel struck through, for clearing filters. */
export const ClearFilter = () => (
  <Glyph>
    <path d="M2 2.5h10L8 7v3.5L6 12V7z" />
    <path d="M2 2l10 10" />
  </Glyph>
)

/** To the first of something: a chevron back against a bar. */
export const First = () => (
  <Glyph>
    <path d="M3.5 3v8M10 3L6 7l4 4" />
  </Glyph>
)

/** To the last of something: a chevron on against a bar. */
export const Last = () => (
  <Glyph>
    <path d="M10.5 3v8M4 3l4 4-4 4" />
  </Glyph>
)

/** Arrows out to a bar at either side, for fitting every column to what is in it. */
export const FitColumns = () => (
  <Glyph>
    <path d="M1.5 3v8M12.5 3v8M4 7h6M5.5 5.5L4 7l1.5 1.5M8.5 5.5L10 7 8.5 8.5" />
  </Glyph>
)

export const Plus = () => (
  <Glyph>
    <path d="M7 2.5v9M2.5 7h9" />
  </Glyph>
)

/** A bare icon button, named by `label` for those who can't see its icon. */
export function IconButton({
  label,
  children,
  ...rest
}: { label: string; children: ReactNode } & ComponentProps<'button'>) {
  return (
    <button type="button" className="prism-data-grid__icon-button" aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}
