import { Button } from '../button'
import { Chevron } from '../../shared'
import { First, FitColumns, Last, Plus } from './icons'
import { numberFormat } from './locale'
import { PageField } from './PageField'
import { useGridLabels } from './useLabels'

export interface GridFooterProps {
  /** How many rows pass the filters. */
  total: number
  page: number
  pages: number
  error: string | null
  /** Whether a change is on its way or a row is being edited, which adding a row and turning the page wait for. */
  busy: boolean
  /** The locale its counts are written in, as the grid's numbers are. */
  locale: string
  /** The same from render to render, so the page picker isn't drawn again for it. */
  onPage(page: number): void
  /** Starts a new row, where the source can add one. */
  onAdd?(): void
  /** Reads the rows again, where they couldn't be read. */
  onRetry?(): void
  /** Fits every column to what is in it, where any can be resized. */
  onFitColumns?(): void
}

// Under the rows: a button to add one, how many there are or what went wrong,
// a button to fit the columns, and the pages: to the first, back, which
// (typed, in PageField), on, and to the last.
export function GridFooter({
  total,
  page,
  pages,
  error,
  busy,
  locale,
  onPage,
  onAdd,
  onRetry,
  onFitColumns,
}: GridFooterProps) {
  const labels = useGridLabels()
  return (
    <div className="prism-data-grid__footer">
      {onAdd && (
        <Button variant="secondary" className="prism-data-grid__button" disabled={busy} onClick={onAdd}>
          <Plus /> {labels.addRow}
        </Button>
      )}
      {error ? (
        <span className="prism-data-grid__status prism-data-grid__status--error" role="alert">
          {error}
        </span>
      ) : (
        <span className="prism-data-grid__status" role="status">
          {labels.rows(total, numberFormat(locale).format(total))}
        </span>
      )}
      {onRetry && (
        <Button variant="secondary" className="prism-data-grid__button" onClick={onRetry}>
          {labels.retry}
        </Button>
      )}
      {onFitColumns && (
        <Button
          variant="secondary"
          className="prism-data-grid__button"
          aria-label={labels.fitColumns}
          title={labels.fitColumns}
          onClick={onFitColumns}
        >
          <FitColumns />
        </Button>
      )}
      {pages > 1 && (
        <nav className="prism-data-grid__pager" aria-label={labels.pages}>
          <Button
            variant="secondary"
            className="prism-data-grid__button"
            aria-label={labels.firstPage}
            disabled={busy || page === 0}
            onClick={() => onPage(0)}
          >
            <First />
          </Button>
          <Button
            variant="secondary"
            className="prism-data-grid__button prism-data-grid__button--previous"
            aria-label={labels.previousPage}
            disabled={busy || page === 0}
            onClick={() => onPage(page - 1)}
          >
            <Chevron />
          </Button>
          <PageField page={page} pages={pages} busy={busy} locale={locale} onPage={onPage} />
          <Button
            variant="secondary"
            className="prism-data-grid__button"
            aria-label={labels.nextPage}
            disabled={busy || page === pages - 1}
            onClick={() => onPage(page + 1)}
          >
            <Chevron />
          </Button>
          <Button
            variant="secondary"
            className="prism-data-grid__button"
            aria-label={labels.lastPage}
            disabled={busy || page === pages - 1}
            onClick={() => onPage(pages - 1)}
          >
            <Last />
          </Button>
          {/* What a screen reader hears as the page turns; the field and list say it already to the eye. */}
          <span className="prism-data-grid__hidden" aria-live="polite">
            {labels.pageShowing(page + 1, pages)}
          </span>
        </nav>
      )}
    </div>
  )
}
