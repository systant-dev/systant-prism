/**
 * Every word the grid says for itself, in English unless given otherwise: what its
 * buttons are called, what it shows where there are no rows, and what stops a row
 * being saved. Values are the rows' own, and numbers and dates are written by `locale`;
 * what a source's error says is the source's.
 */
export interface DataGridLabels {
  /** The button that starts a new row. */
  addRow: string
  /** The button that reads the rows again, where they couldn't be read. */
  retry: string
  /** How many rows pass the filters: the count, and the count as the locale writes it. */
  rows(count: number, written: string): string
  /** In place of the rows where there are none, and where they couldn't be read. */
  noRows: string
  unreadable: string

  /** What a screen reader calls the page buttons together, and each of them. */
  pages: string
  firstPage: string
  previousPage: string
  nextPage: string
  lastPage: string
  /** Before the field a page is typed in, and after it: how many pages there are, as the locale writes it. */
  page: string
  ofPages(written: string): string
  /** What a screen reader calls that field, and hears as the page turns. */
  pageField(pages: number): string
  pageShowing(page: number, pages: number): string

  /** What a screen reader calls the lanes at either side of the header. */
  details: string
  actions: string
  /** The button that clears every filter, and a column's filter, from its header. */
  clearFilters: string
  filter(header: string): string
  /** What a number column's filter and a money column's say they take, as a tooltip. */
  numberFilterHint: string
  moneyFilterHint: string
  /** The handle on a header's edge that changes its column's width: its name, from the header, and its tooltip. */
  resize(header: string): string
  resizeHint: string
  /** The button under the rows that fits every column to what is in it. */
  fitColumns: string

  /** A row's buttons: for its child collections, and to edit or delete it. */
  showDetails: string
  hideDetails: string
  editRow: string
  deleteRow: string
  /** The two that take the delete button's place as it asks first. */
  confirmDelete: string
  keepRow: string
  /** What a screen reader calls the selector of a row's child collections. */
  collection: string

  /** A row being edited or added, to a screen reader, and its buttons. */
  editedRow: string
  newRow: string
  save: string
  cancel: string
  /** In a dropdown's editor: the choice of nothing, and the button's name, from its column's header and the choice's label, if it has one. */
  none: string
  choice(header: string, label: string | undefined): string

  /** A ticked checkbox and an unticked one, to a screen reader and in its filter. */
  yes: string
  no: string

  /** What each summary is called in its cell. */
  total: string
  min: string
  max: string
  average: string

  /** What stops a row being saved: the column's header and what is wrong with it. */
  invalid(header: string, problem: string): string
  mustBeNumber: string
  mustBeAmount: string
  /** For a text column with an input mask: the mask's shape, '(___) ___-____'. */
  mustFill(shape: string): string
}

export const DEFAULT_LABELS: DataGridLabels = {
  addRow: 'Add row',
  retry: 'Retry',
  rows: (count, written) => (count === 1 ? '1 row' : `${written} rows`),
  noRows: 'No rows',
  unreadable: 'The rows could not be read.',

  pages: 'Pages',
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
  page: 'Page',
  ofPages: (written) => `of ${written}`,
  pageField: (pages) => `Page, of ${pages}`,
  pageShowing: (page, pages) => `Page ${page} of ${pages}`,

  details: 'Details',
  actions: 'Actions',
  clearFilters: 'Clear filters',
  filter: (header) => `Filter ${header}`,
  numberFilterHint: 'A number, or a comparison such as >10',
  moneyFilterHint: 'An amount, or a comparison such as >100',
  resize: (header) => `Resize ${header}`,
  resizeHint: 'Drag to resize, double-click to fit',
  fitColumns: 'Fit columns',

  showDetails: 'Show details',
  hideDetails: 'Hide details',
  editRow: 'Edit row',
  deleteRow: 'Delete row',
  confirmDelete: 'Delete this row',
  keepRow: 'Keep this row',
  collection: 'Collection',

  editedRow: 'Edited row',
  newRow: 'New row',
  save: 'Save',
  cancel: 'Cancel',
  none: 'None',
  choice: (header, label) => `${header}: ${label ?? 'none'}`,

  yes: 'Yes',
  no: 'No',

  total: 'Total',
  min: 'Min',
  max: 'Max',
  average: 'Average',

  invalid: (header, problem) => `${header} ${problem}.`,
  mustBeNumber: 'must be a number',
  mustBeAmount: 'must be an amount',
  mustFill: (shape) => `must be filled in as ${shape}`,
}
