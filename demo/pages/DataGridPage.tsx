import { useState } from 'react'
import { DataGrid, HorizontalSelector, restSource, type DataGridColumns, type DataGridRow } from '../../src'
import { DemoPage, Section } from '../layout'

const customers = [
  {
    id: 1,
    name: 'Ada Lovelace',
    city: 'London',
    phone: '02079460958',
    credit: 1200,
    active: true,
    orders: [
      { id: 101, item: 'Difference engine', total: 1999.5, shipped: true },
      { id: 102, item: 'Punched cards', total: 12.25, shipped: false },
    ],
    contacts: [{ kind: 'Email', value: 'ada@example.com' }],
  },
  {
    id: 2,
    name: 'Grace Hopper',
    city: 'New York',
    phone: '02125550143',
    credit: 860,
    active: true,
    orders: [{ id: 201, item: 'Compiler', total: 640, shipped: true }],
    contacts: [],
  },
  {
    id: 3,
    name: 'Alan Turing',
    city: 'Manchester',
    phone: '01614960000',
    credit: 410,
    active: false,
    orders: [],
    contacts: [],
  },
  {
    id: 4,
    name: 'Émilie du Châtelet',
    city: 'Paris',
    phone: null,
    credit: 975,
    active: true,
    orders: [],
    contacts: [],
  },
  {
    id: 5,
    name: 'Katherine Johnson',
    city: 'Hampton',
    phone: '07700900123',
    credit: 1530,
    active: true,
    orders: [],
    contacts: [],
  },
]

// Mostly just headers: the grid works the types out from the values (numbers, and checkboxes for
// booleans). City is made a dropdown, listing the cities found in the rows.
const customerColumns: DataGridColumns = {
  name: { header: 'Name' },
  city: { header: 'City', type: 'dropdown' },
  // Stored as digits, shown through the mask.
  phone: { header: 'Phone', mask: '(999) 9999-9999' },
  // In pounds, as the reader's locale writes them.
  credit: { header: 'Credit', type: 'money', currency: 'GBP' },
  active: { header: 'Active' },
  orders: { header: 'Orders' },
  item: { header: 'Item' },
  total: { header: 'Total' },
  shipped: { header: 'Shipped' },
  contacts: { header: 'Contacts' },
}

const cities = ['London', 'Paris', 'Berlin', 'Lisbon', 'Oslo', 'Rome', 'Vienna', 'Prague']

const readings = Array.from({ length: 100_000 }, (_, i) => ({
  id: i + 1,
  sensor: `S-${(i % 97) + 1}`,
  city: cities[i % cities.length],
  temperature: Math.round(Math.sin(i / 50) * 150 + 120) / 10,
  ok: i % 13 !== 0,
}))

// Filters are off for the grid and turned back on for city alone. The summary row shows the hottest reading.
const readingColumns: DataGridColumns = {
  city: { showFilter: true },
  // The maximum rather than a total, as a total of temperatures means nothing.
  temperature: { summary: 'max', mask: '0.0 °C' },
}

// The demo has no server, so this answers the requests a restSource sends as a
// REST collection would, from rows in memory and a little late, as over a network.
function memoryApi(start: DataGridRow[]): typeof fetch {
  let rows = start.map((row) => ({ ...row }))
  let nextId = Math.max(...rows.map((r) => Number(r.id))) + 1
  const reply = (body: unknown, status = 200) =>
    new Promise<Response>((resolve) =>
      setTimeout(() => resolve(new Response(body === undefined ? null : JSON.stringify(body), { status })), 400),
    )
  return async (input, init) => {
    const id = Number(String(input).split('/')[3])
    const body = init?.body ? (JSON.parse(String(init.body)) as DataGridRow) : {}
    switch (init?.method) {
      case 'POST': {
        const row = { ...body, id: nextId++ }
        rows = [...rows, row]
        return reply(row, 201)
      }
      case 'PATCH':
      case 'PUT': {
        const row = { ...(init.method === 'PATCH' ? rows.find((r) => r.id === id) : {}), ...body, id }
        rows = rows.map((r) => (r.id === id ? row : r))
        return reply(row)
      }
      case 'DELETE':
        rows = rows.filter((r) => r.id !== id)
        return reply(undefined, 204)
      default:
        return reply(rows)
    }
  }
}

// One column of every type except JSON.
const productColumns: DataGridColumns = {
  // An id isn't worth filtering by, nor more room than it needs.
  id: { showFilter: false, width: 'auto' },
  name: { header: 'Name', type: 'text' },
  // Typed through an input mask: three letters, written as capitals, then four digits.
  sku: { header: 'SKU', mask: 'AAA-9999' },
  category: {
    header: 'Category',
    type: 'dropdown',
    options: [
      { value: 'optics', label: 'Optics' },
      { value: 'light', label: 'Light' },
      { value: 'support', label: 'Support' },
    ],
  },
  // Asking for a summary shows the summary row, for this column alone.
  price: { header: 'Price', type: 'money', currency: 'GBP', summary: 'average' },
  released: { header: 'Released', type: 'date', mask: 'dd/MM/yyyy' },
  featured: { header: 'Featured', type: 'checkbox' },
}

// Made once, as a grid reads its source again whenever it is given a new one.
const products = restSource('/api/products', {
  fetch: memoryApi([
    { id: 1, name: 'Prism', sku: 'PRS-0001', category: 'optics', price: 49.99, released: '2024-03-12', featured: true },
    { id: 2, name: 'Lens', sku: 'LNS-0420', category: 'optics', price: 19.5, released: '2023-09-01', featured: false },
    { id: 3, name: 'Tripod', sku: 'TRP-1100', category: 'support', price: 32, released: null, featured: false },
    { id: 4, name: 'Filter', sku: 'FLT-0075', category: 'light', price: 8.75, released: '2025-01-20', featured: true },
  ]),
})

// Each locale with the currency its money is in: the grid takes it as given, never from the locale.
const currencies: Readonly<Record<string, string>> = {
  'en-GB': 'GBP',
  'en-US': 'USD',
  'fr-FR': 'EUR',
  'de-DE': 'EUR',
  'de-CH': 'CHF',
  'ja-JP': 'JPY',
}
const locales = Object.keys(currencies).map((locale) => ({ value: locale, label: locale }))

const invoices = [
  { id: 1, client: 'Lovelace & Co', amount: 1000, hours: 12.5, sent: '2026-11-02' },
  { id: 2, client: 'Hopper Ltd', amount: 2450.75, hours: 31.25, sent: '2026-10-14' },
  { id: 3, client: 'Turing Labs', amount: 99.99, hours: 1.5, sent: '2026-09-30' },
]

// Money in its currency as the locale writes it, a mask with its separators, and dates and the calendar filter its way.
const invoiceColumns: DataGridColumns = {
  client: { header: 'Client' },
  amount: { header: 'Amount', type: 'money' },
  hours: { header: 'Hours', mask: '#,##0.00' },
  sent: { header: 'Sent', type: 'date' },
}

// The same grid in a locale picked above it.
function LocaleDemo() {
  const [locale, setLocale] = useState('en-GB')
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <HorizontalSelector
        aria-label="Locale"
        items={locales}
        value={locale}
        onChange={setLocale}
        style={{ justifySelf: 'start' }}
      />
      <DataGrid
        aria-label="Invoices"
        data={invoices}
        columns={invoiceColumns}
        locale={locale}
        currency={currencies[locale]}
        showSummary
        style={{ '--prism-data-grid-height': '340px' }}
      />
    </div>
  )
}

export function DataGridPage() {
  return (
    <DemoPage
      name="DataGrid"
      intro={
        <p style={{ marginTop: 0 }}>
          A data grid on glass, for rows of JSON. Click a column's header to sort by it, and use the box under the
          header to filter. Drag the edge of a header to resize its column, double-click the edge to fit the column to
          its content, or fit every column with the button under the rows. Expand a row to see its nested collections.
          Each column has a type: text, number, checkbox, money, dropdown, date or JSON. You can set it, or leave the
          grid to work it out from the values, and it decides how the column is shown, sorted, filtered and edited. Only
          the rows in view are rendered, so 100,000 rows scroll as smoothly as a few. Given a <code>source</code>, the
          grid loads its rows from an API and saves additions, edits and deletions back to it.
        </p>
      }
      demos={
        <>
          <Section title="Rows with nested collections" column={600}>
            <DataGrid aria-label="Customers" data={customers} columns={customerColumns} showSummary />
          </Section>

          <Section title="Every column type, loaded from an API" column={600}>
            <DataGrid
              aria-label="Products"
              source={products}
              columns={productColumns}
              style={{ '--prism-data-grid-height': '360px' }}
            />
          </Section>

          <Section title="Locales" column={600}>
            <LocaleDemo />
          </Section>

          <Section title="100,000 rows, in pages of 1,000" column={600}>
            <DataGrid
              aria-label="Readings"
              data={readings}
              pageSize={1000}
              showFilter={false}
              showSummary
              columns={readingColumns}
            />
          </Section>
        </>
      }
      props={[
        ['data', 'DataGridRow[]', '', 'The rows, as JSON. Nested arrays of objects are child collections.'],
        [
          'source',
          'DataGridSource',
          '',
          'Used in place of data: where the rows are loaded from and changes are saved to. See restSource.',
        ],
        [
          'columns',
          'Record<string, { header?, type?, options?, showFilter?, summary?, mask?, saveMask?, currency?, width?, resizable? }>',
          '',
          "Settings for each column, keyed by property name: its header, type, dropdown options, filter, summary, mask and width (in px, or 'auto' to fit its content). Whatever is left out is worked out from the rows.",
        ],
        [
          'resizable',
          'boolean',
          'true',
          "Whether a header's edge can be dragged to resize its column, or double-clicked to fit it; a column's own resizable overrides it.",
        ],
        ['showFilter', 'boolean', 'true', "Filters under the headers; a column's own showFilter overrides it."],
        [
          'showSummary',
          'boolean',
          'false',
          "Show a summary row that totals every number column except the row key; a column's own summary overrides it.",
        ],
        [
          'locale',
          'string',
          "the browser's",
          'BCP 47 language tag used to format and read numbers, money, dates, masks and filters.',
        ],
        [
          'currency',
          'string',
          '',
          "ISO 4217 currency for money columns that don't set their own. A money column with no currency is shown as a plain number.",
        ],
        ['confirmDelete', 'boolean', 'true', "Whether a row's delete button asks for confirmation first."],
        [
          'labels',
          'Partial<DataGridLabels>',
          '',
          "The grid's own text, such as button names and messages, to translate or reword. Whatever is left out stays in English.",
        ],
        ['rowKey', 'string', "'id'", 'The property that uniquely identifies a row.'],
        ['pageSize', 'number', '0', 'Rows per page; 0 puts every row on one page.'],
        ['rowHeight', 'number', '44', 'Height of a row, in px.'],
        ['detailHeight', 'number', '320', "Height of an expanded row's child collections, in px."],
        [
          'childSource',
          '(parent, collection) => DataGridSource',
          '',
          'Returns a source for a child collection, to load and save it through an API of its own.',
        ],
        ['', '', '', 'Every other Card prop except padding, ref included; aria-label names the table.'],
      ]}
      customProperties={[
        ['--prism-data-grid-height', '480px', 'Height of the grid.'],
        [
          '--prism-data-grid-column-min',
          '120px',
          'Minimum width of a column with no width of its own. Once the columns can shrink no further, the grid scrolls sideways.',
        ],
        ['--prism-data-grid-expander-width', '44px', 'Width of the column of expand buttons.'],
        ['--prism-data-grid-actions-width', '84px', 'Width of the column of edit and delete buttons.'],
        ['--prism-data-grid-cell-padding', '12px', 'Padding at the sides of a cell.'],
        [
          '--prism-data-grid-fade',
          '32px',
          'Width of the fade at a side where more columns can be scrolled into view. The expand and edit/delete columns stay clear of it.',
        ],
        ['--prism-data-grid-line', '', 'Colour of the lines between rows: the text colour at 14%.'],
        ['--prism-data-grid-hover', '', 'Tint of a hovered or edited row: the text colour at 6%.'],
        ['--prism-data-grid-detail-bg', '', "Tint behind a row's child collections: the text colour at 4%."],
        ['--prism-data-grid-error', '#c62f2f', 'Colour of an error (#ff8a8a in dark mode).'],
        ['--prism-data-grid-focus', '#6d7cff', 'Focus ring of the header and icon buttons (#9aa5ff in dark mode).'],
      ]}
    />
  )
}
