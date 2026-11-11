import { memo, useState, type CSSProperties } from 'react'
import { HorizontalSelector } from '../selector'
import { GridView, type GridOptions } from './GridView'
import { held } from './held'
import type { Row } from './types'
import { useGridLabels } from './useLabels'
import { sameItemProps } from './VirtualRows'

export interface GridDetailProps extends GridOptions {
  /** The row whose child collections show. */
  row: Row
  /** The properties holding them, each with the columns it has across every row's. */
  collections: readonly string[]
  childColumns: Readonly<Record<string, readonly string[]>>
  /** How many columns it spans. */
  span: number
  style: CSSProperties
}

// The child collections of a row, under it: a grid of one at a time, with a
// selector to pick which where there are more. Each is the nested rows as they
// came, or what the child source made for them reads. Memoised, as a row is,
// so the grid in it isn't drawn again as the parent's state changes.
export const GridDetail = memo(function GridDetail({
  row,
  collections,
  childColumns,
  span,
  style,
  ...options
}: GridDetailProps) {
  const [shown, setShown] = useState(collections[0])
  const labels = useGridLabels()
  const nameOf = (key: string) => held(options.columns, key)?.header ?? key
  return (
    <div className="prism-data-grid__detail" role="row" style={style}>
      <div className="prism-data-grid__detail-cell" role="cell" aria-colspan={span}>
        {collections.length > 1 ? (
          <HorizontalSelector
            aria-label={labels.collection}
            items={collections.map((key) => ({ value: key, label: nameOf(key) }))}
            value={shown}
            onChange={setShown}
          />
        ) : (
          <span className="prism-data-grid__detail-title">{nameOf(shown)}</span>
        )}
        <ChildGrid
          key={shown}
          row={row}
          collection={shown}
          emptyColumns={held(childColumns, shown) ?? NONE}
          {...options}
        />
      </div>
    </div>
  )
}, sameItemProps)

/** No columns, the same each time, so a child grid with none doesn't read its rows again as it is drawn. */
const NONE: readonly string[] = []

interface ChildGridProps extends GridOptions {
  row: Row
  collection: string
  emptyColumns: readonly string[]
}

function ChildGrid({ row, collection, emptyColumns, ...options }: ChildGridProps) {
  // Made once, as the detail opens: a new source would be read again.
  const [source] = useState(() => options.childSource?.(row, collection))
  const nested = held(row, collection)
  return (
    <GridView
      {...options}
      aria-label={held(options.columns, collection)?.header ?? collection}
      data={source ? undefined : Array.isArray(nested) ? (nested as Row[]) : []}
      source={source}
      emptyColumns={emptyColumns}
    />
  )
}
