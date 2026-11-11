import { useState } from 'react'
import { Textbox } from '../textbox'
import { clamp } from '../../shared'
import { latinDigits, numberFormat } from './locale'
import { onEnter } from './onEnter'
import { useGridLabels } from './useLabels'

export interface PageFieldProps {
  page: number
  pages: number
  busy: boolean
  locale: string
  onPage(page: number): void
}

// "Page [ 57 ] of 100": a field to type a page into. What is typed is read as
// Enter is pressed or the focus leaves: a page past the end goes to the last,
// and anything that isn't a page puts back the page showing, as Escape does.
export function PageField({ page, pages, busy, locale, onPage }: PageFieldProps) {
  const labels = useGridLabels()
  // What is typed, until it is read; the page showing otherwise.
  const [typed, setTyped] = useState<string | null>(null)

  const go = () => {
    if (typed === null) return
    // In the digits the count beside it is written in, or Latin ones.
    const wanted = Number.parseInt(latinDigits(typed, locale), 10)
    const choice = Number.isFinite(wanted) ? clamp(wanted, 1, pages) - 1 : page
    if (choice !== page) onPage(choice)
    setTyped(null)
  }

  return (
    <span className="prism-data-grid__page">
      <span aria-hidden="true">{labels.page}</span>
      <Textbox
        className="prism-data-grid__page-field"
        aria-label={labels.pageField(pages)}
        inputMode="numeric"
        value={typed ?? String(page + 1)}
        disabled={busy}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setTyped(null)
          else onEnter(go)(event)
        }}
        onBlur={go}
      />
      <span aria-hidden="true">{labels.ofPages(numberFormat(locale).format(pages))}</span>
    </span>
  )
}
