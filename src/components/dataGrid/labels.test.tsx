import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualResizes } from '../../../test/dom'
import { KINDS } from './columnTypes'
import { readShape } from './columns'
import { DataGrid } from './DataGrid'
import { DEFAULT_LABELS, type DataGridLabels } from './labels'
import type { DataGridSource, Row } from './types'
import { useLabels } from './useLabels'

beforeEach(() => {
  manualResizes()
})

afterEach(cleanup)

/** The grid's words in French: every one a grid in these tests shows. */
const FRENCH: Partial<DataGridLabels> = {
  addRow: 'Ajouter une ligne',
  rows: (count, written) => (count === 1 ? '1 ligne' : `${written} lignes`),
  noRows: 'Aucune ligne',
  pages: 'Pages du tableau',
  nextPage: 'Page suivante',
  page: 'Page n°',
  ofPages: (written) => `sur ${written}`,
  pageField: (pages) => `Page, sur ${pages}`,
  pageShowing: (page, pages) => `Page ${page} sur ${pages}`,
  clearFilters: 'Effacer les filtres',
  filter: (header) => `Filtrer ${header}`,
  resize: (header) => `Redimensionner ${header}`,
  resizeHint: 'Faire glisser pour redimensionner',
  fitColumns: 'Ajuster les colonnes',
  showDetails: 'Afficher les détails',
  hideDetails: 'Masquer les détails',
  editRow: 'Modifier la ligne',
  deleteRow: 'Supprimer la ligne',
  confirmDelete: 'Supprimer cette ligne',
  keepRow: 'Garder cette ligne',
  newRow: 'Nouvelle ligne',
  save: 'Enregistrer',
  cancel: 'Annuler',
  yes: 'Oui',
  no: 'Non',
  total: 'Somme',
  invalid: (header, problem) => `${header} : ${problem}`,
  mustBeNumber: 'doit être un nombre',
}

const people = () => [
  { id: 1, name: 'Ada', age: 36, active: true, orders: [{ id: 10, item: 'Engine' }] },
  { id: 2, name: 'Grace', age: 85, active: false, orders: [] },
]

function memorySource(rows: Row[]) {
  return {
    read: vi.fn<() => Promise<Row[]>>(async () => rows),
    create: vi.fn<(row: Partial<Row>) => Promise<Row>>(async (row) => ({ ...row, id: 100 })),
    update: vi.fn<(row: Row, changes: Partial<Row>) => Promise<Row>>(async (row, changes) => ({ ...row, ...changes })),
    remove: vi.fn<(row: Row) => Promise<void>>(async () => {}),
  } satisfies DataGridSource
}

describe('useLabels', () => {
  it('is the English ones where none are given, and those given over them', () => {
    expect(renderHook(() => useLabels(undefined)).result.current).toEqual(DEFAULT_LABELS)
    const { result } = renderHook(() => useLabels({ addRow: 'Ajouter', yes: 'Oui' }))
    expect(result.current).toMatchObject({ addRow: 'Ajouter', yes: 'Oui', no: 'No', retry: 'Retry' })
  })

  it('stays the same object while what is given holds the same, written inline or not', () => {
    const { result, rerender } = renderHook(({ addRow }) => useLabels({ addRow, rows: FRENCH.rows }), {
      initialProps: { addRow: 'Ajouter' },
    })
    const first = result.current
    rerender({ addRow: 'Ajouter' })
    expect(result.current).toBe(first)

    rerender({ addRow: 'Nouvelle' })
    expect(result.current).not.toBe(first)
    expect(result.current.addRow).toBe('Nouvelle')
  })
})

describe('the words of a column type', () => {
  it('names a checkbox as its column is told to, in its cells and its filter', () => {
    const [column] = readShape([{ active: true }], {}, { labels: { yes: 'Oui', no: 'Non' } }).columns
    expect(column.options.map((option) => option.label)).toEqual(['Oui', 'Non'])
    expect(KINDS.checkbox.format(true, column)).toBe('Oui')
    expect(KINDS.checkbox.format(false, column)).toBe('Non')
    expect(KINDS.checkbox.format(null, column)).toBe('')
    // English with none given.
    expect(KINDS.checkbox.format(true, readShape([{ active: true }]).columns[0])).toBe('Yes')
  })

  it('says what is wrong with a draft in the words it is given, or else in English', () => {
    const [column] = readShape([{ age: 1 }]).columns
    expect(KINDS.number.check!('x', column)).toBe('must be a number')
    expect(KINDS.number.check!('x', column, { ...DEFAULT_LABELS, mustBeNumber: 'doit être un nombre' })).toBe(
      'doit être un nombre',
    )
  })
})

describe('DataGrid in words of its own', () => {
  it('says everything it says for itself in them', async () => {
    const source = memorySource(people())
    render(<DataGrid aria-label="Personnes" source={source} labels={FRENCH} showSummary />)
    await screen.findByText('Ada')

    expect(screen.getByRole('status').textContent).toBe('2 lignes')
    expect(screen.getByRole('textbox', { name: 'Filtrer name' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Effacer les filtres' })).toBeTruthy()
    expect(screen.getByRole('separator', { name: 'Redimensionner name' }).title).toBe(
      'Faire glisser pour redimensionner',
    )
    expect(screen.getByRole('button', { name: 'Ajuster les colonnes' })).toBeTruthy()
    // A checkbox's cells, to those who can't see the tick.
    const cells = [...document.querySelectorAll('.prism-data-grid__cell--checkbox')].map((cell) => cell.textContent)
    expect(cells).toEqual(['Oui', 'Non'])
    expect(document.querySelector('.prism-data-grid__summary-label')!.textContent).toBe('Somme')

    // A row asked to go, and kept.
    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer la ligne' })[0])
    expect(screen.getByRole('button', { name: 'Supprimer cette ligne' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Garder cette ligne' }))
    expect(source.remove).not.toHaveBeenCalled()

    // A new row that can't be saved says why.
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une ligne/ }))
    const editor = screen.getByRole('row', { name: 'Nouvelle ligne' })
    fireEvent.change(within(editor).getByRole('textbox', { name: 'age' }), { target: { value: 'x' } })
    await act(async () => fireEvent.click(within(editor).getByRole('button', { name: 'Enregistrer' })))
    expect(screen.getByRole('alert').textContent).toBe('age : doit être un nombre')
    fireEvent.click(within(editor).getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('row', { name: 'Nouvelle ligne' })).toBeNull()
  })

  it('says so in them where there are no rows, and names its pages by them', () => {
    const { rerender } = render(<DataGrid aria-label="Personnes" data={[]} labels={FRENCH} />)
    expect(screen.getByText('Aucune ligne')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('0 lignes')

    const many = Array.from({ length: 30 }, (_, i) => ({ id: i, name: `n${i}` }))
    rerender(<DataGrid aria-label="Personnes" data={many} pageSize={10} labels={FRENCH} />)
    const pages = screen.getByRole('navigation', { name: 'Pages du tableau' })
    expect(within(pages).getByRole('textbox', { name: 'Page, sur 3' })).toBeTruthy()
    expect(pages.textContent).toContain('Page n°')
    expect(pages.textContent).toContain('sur 3')
    fireEvent.click(within(pages).getByRole('button', { name: 'Page suivante' }))
    expect(within(pages).getByText('Page 2 sur 3')).toBeTruthy()
    // What it isn't given stays English.
    expect(within(pages).getByRole('button', { name: 'First page' })).toBeTruthy()
  })

  it("gives a row's child grid the same words", () => {
    render(<DataGrid aria-label="Personnes" data={people()} labels={FRENCH} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Afficher les détails' })[0])
    expect(screen.getAllByRole('button', { name: 'Masquer les détails' })).toHaveLength(1)
    const orders = screen.getByRole('table', { name: 'orders' })
    expect(within(orders.parentElement!).getByRole('status').textContent).toBe('1 ligne')
    expect(within(orders).getByRole('textbox', { name: 'Filtrer item' })).toBeTruthy()
  })
})
