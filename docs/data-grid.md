# DataGrid

[← Back to the README](../README.md)

A data grid for rows of JSON, on a glass [Card](card.md). Each property of the rows becomes a column, with its header and type taken from `columns` or, where that says nothing, from the property's name and values. Each property that is an array of objects is a child collection: a row with child collections can be expanded to show them in a grid under it, with a selector to choose between them when there are several.

- **Sort** by clicking a column's header: first ascending, then descending, then back to the original order. Empty values always go last.
- **Filter** with the field under each header. A row is shown when it passes every column's filter. A button at the end of the filter row clears every filter.
- **Pages** of `pageSize` rows, with buttons for the first, previous, next and last page, and a field to type a page number into. Changing the sort or a filter goes back to the first page.
- **Virtualised**: only the rows in view are rendered, so a page of 100,000 rows scrolls as smoothly as a page of ten. That is why every row is `rowHeight` tall and an expanded row's child collections are `detailHeight` tall.
- **Resize** a column by dragging the far edge of its header, or double-click that edge to fit the column to its content in every row that passes the filters. With the focus on the edge, the arrow keys move it and Enter fits the column. A button under the rows fits every column at once. A column starts with an equal share of the grid's width, unless it has a `width`: a number of px, or `'auto'` to fit it to its content when its rows are first shown.
- **Scrolls sideways** when its columns don't fit, along with its header and summary row. The expand buttons and the edit and delete buttons stay fixed at the sides. The body is a Tab stop, so the arrow keys, Page Up and Page Down scroll it too.

```tsx
const customers = [
  { id: 1, name: 'Ada', credit: 1200, orders: [{ id: 101, item: 'Engine', total: 1999.5 }] },
  { id: 2, name: 'Grace', credit: 860, orders: [] },
]

<DataGrid
  aria-label="Customers"
  data={customers}
  columns={{ name: { header: 'Name' }, credit: { header: 'Credit (£)' }, orders: { header: 'Orders' } }}
  pageSize={50}
/>
```

## Column types

A column's type decides how its values are shown, sorted, filtered and edited. Set it in `columns`, keyed by property name. A column with no type gets one from its values: `number` for numbers, `checkbox` for booleans, `json` for objects and arrays, and `text` for anything else, or where the values are of mixed types. A column is never made a `money`, `dropdown` or `date` column automatically.

| Type       | Shows                                                                                 | Sorts                                 | Filter                                                                                                  | Editor                                                                             |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `text`     | The text                                                                              | Alphabetically, in the locale's order | Contains the typed text, ignoring case and accents                                                      | A [Textbox](textbox.md)                                                            |
| `number`   | The number, at the end of the cell                                                    | By size                               | Contains the typed text, or a comparison: `>10`, `<=2.5`, `=0`                                          | A Textbox that only accepts a number                                               |
| `money`    | The amount in the column's currency, formatted for the locale (£1,000.00, 1 000,00 €) | By size                               | As a number, with or without the currency symbol (`>£100`)                                              | A Textbox that only accepts an amount                                              |
| `checkbox` | A tick when true                                                                      | Unticked first                        | A [Combobox](combobox.md) of Yes and No; an empty value counts as No                                    | A [Toggle](toggle.md)                                                              |
| `dropdown` | The label of the selected option                                                      | By label                              | A Combobox of the options: a row is shown when its value is one of those selected                       | A button that opens a [Menu](menu.md) of the options, plus None to clear the value |
| `date`     | The date, formatted for the locale                                                    | Chronologically                       | A range of days picked on a range [Calendar](calendar.md), inclusive; a row with no date is never shown | A [Calendar](calendar.md), which saves `YYYY-MM-DD`                                |
| `json`     | Arrays as comma-separated values, objects as JSON                                     | As text                               | Contains the typed text                                                                                 | None: it is read-only                                                              |

```tsx
const columns: DataGridColumns = {
  name: { header: 'Name' },
  status: {
    header: 'Status',
    type: 'dropdown',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  },
  due: { header: 'Due', type: 'date' },
  done: { header: 'Done' }, // booleans are checkboxes already
}

<DataGrid aria-label="Tasks" source={tasks} columns={columns} />
```

- A dropdown's `options` are the values as they are stored, strings or numbers, each given on its own or as `{ value, label }`. Left out, the options are every value found in the column.
- A date is either an ISO date string, `'2026-11-09'`, which means that day in the reader's time zone, or a timestamp. An edited date is saved as an ISO date string.
- The keys of `columns` can also name child collections, so `{ orders: { header: 'Orders' } }` sets that collection's label in the selector. A child grid uses the same `columns` for its own columns.
- A column's own `showFilter` overrides the grid's: `{ id: { showFilter: false } }` removes the filter from an id column. A filter that is hidden while it has a value stops filtering.

## Summary row

A summary row under the data rows shows a figure for each number and money column, worked out over every row that passes the filters, on every page. `showSummary` turns it on, with a total in each of those columns except the `rowKey` column. A column's own `summary` sets which figure it shows: `'total'`, `'min'`, `'max'` or `'average'`, or `false` for none. If any column has a `summary`, the row is shown even without `showSummary`.

```tsx
<DataGrid
  data={orders}
  showSummary // totals every number column except the id
  columns={{ price: { summary: 'average' }, discount: { summary: false } }}
/>
```

Empty values and text that isn't a number are skipped. A result is rounded to as many decimal places as the most precise value has, and an average to two more, so 0.1 and 0.2 total 0.3. A child grid uses the same `showSummary` and `columns`.

## Masks

What a column's `mask` does depends on the column's type. A mask on a checkbox, dropdown or JSON column is ignored.

**Number and money columns: a display format.** The mask sets how values are formatted in the cells and the summary row; the editor still takes a plain number. It is an Excel-style format code:

| Code          | Meaning                                                               |
| ------------- | --------------------------------------------------------------------- |
| `0`           | A digit, always shown: 0 if the number has no digit there.            |
| `#`           | A digit, shown only if it is significant.                             |
| `,`           | In the whole-number part: groups the thousands.                       |
| `.`           | The decimal point; the `0`s and `#`s after it are the decimal places. |
| `%`           | Shows the number as a percentage (multiplied by 100).                 |
| Anything else | Literal text, before or after the digits.                             |

`#,##0.00` writes 1,234.50 for 1234.5, `£#,##0.00` £1,234.50, `0.0%` 25.6% for 0.256, `0.0 kg` 2.5 kg and `000` 007. As in Excel, `,` and `.` stand for the [locale](#locale-and-money)'s separators, so `#,##0.00` writes 1.234,50 in de-DE. Numbers are rounded half away from zero. On a money column the mask replaces the currency's usual format, so include the symbol: `#,##0.00 €`. A number filter matches the formatted text as well as the number itself.

**Date columns: a display format.** The mask is a [Calendar](calendar.md) pattern, such as `dd/MM/yyyy` or `d MMM yyyy`. Dates typed into the editor and the filter use the same pattern.

**Text columns: an input mask**, which constrains what can be typed. It uses [react-input-mask](https://github.com/sanniassin/react-input-mask)'s codes:

| Code | Accepts                                                               |
| ---- | --------------------------------------------------------------------- |
| `9`  | A digit.                                                              |
| `a`  | A letter.                                                             |
| `*`  | A letter or a digit.                                                  |
| `A`  | A letter, shown as a capital.                                         |
| `X`  | A letter or a digit, shown as a capital.                              |
| `\`  | Makes the next character literal. Any other character is literal too. |

As a value is typed, characters that don't fit the next slot are dropped and the mask's literal characters are inserted. An empty field shows the shape of the mask, `(___) ____-____`. A value is saved only once every slot is filled: until then the field is marked as invalid and the grid explains why under the rows. It is saved formatted, with the mask's literal characters, or, with the column's `saveMask: false`, as just the characters typed into its slots, `02079460958`. A stored value that fits the mask is shown formatted, and a filter finds it in either form.

```tsx
<DataGrid
  data={orders}
  columns={{
    phone: { mask: '(999) 9999-9999' },
    amount: { mask: '£#,##0.00' },
    placed: { type: 'date', mask: 'dd/MM/yyyy' },
  }}
/>
```

## Locale and money

`locale` sets how the grid formats and reads everything that varies from country to country. Left out, it is the browser's language. A server can't know that, so it renders as en-US and the grid switches to the browser's language after hydration; to render in a particular locale from the start, give the grid a `locale`.

- **Money** is shown in its currency, formatted for the locale: £1,000.00 in en-GB, 1 000,00 € in fr-FR. Its currency is the column's `currency`, or else the grid's. A money column with neither is treated as a number column: the grid doesn't guess a currency from the locale.
- **Numbers** are shown with the locale's decimal separator and no thousands separator (1234,5 in de-DE).
- **Typing** a number or an amount, in an editor or a filter's comparison, follows the locale's format, with or without thousands separators: `1.234,5` or `1234,5` in de-DE. A decimal point where the locale uses a comma isn't accepted as a number. Where the locale has its own digits, either those or Latin digits are accepted.
- **Dates**, and the calendars that edit and filter them, follow the locale: the order of a date's parts, the month names and the first day of the week.
- **Text** is sorted in the locale's alphabetical order, ignoring case.

```tsx
<DataGrid
  data={invoices}
  locale="fr-FR"
  currency="EUR"
  columns={{ amount: { type: 'money' }, sent: { type: 'date' } }}
/>
```

## Labels

All of the grid's own text is in English unless you supply it in `labels`: the names of its buttons, the words for a checkbox's values, the names of the summaries, and its messages. Supply any of `DataGridLabels` and the rest keep their English defaults. A child grid uses its parent's labels.

```tsx
import { DataGrid, type DataGridLabels } from '@systant/prism'

// Created once, outside the component: some labels are functions, and a new object on each render makes every row render again.
const french: Partial<DataGridLabels> = {
  addRow: 'Ajouter une ligne',
  rows: (count, written) => (count === 1 ? '1 ligne' : `${written} lignes`),
  noRows: 'Aucune ligne',
  filter: (header) => `Filtrer ${header}`,
  yes: 'Oui',
  no: 'Non',
  total: 'Somme',
  invalid: (header, problem) => `${header} : ${problem}`,
  mustBeNumber: 'doit être un nombre',
}

<DataGrid data={invoices} locale="fr-FR" labels={french} />
```

Labels that include a count or a name are functions: `rows(count, written)` receives the number of rows and the same number formatted for the locale, and `invalid(header, problem)` a column's header and the problem with its value. The `DataGridLabels` type documents the rest.

## Through an API

Given a `source` instead of `data`, the grid loads its rows from the source and lets them be changed as far as the source allows: an **Add row** button if the source has `create`, an edit button on each row if it has `update`, and a delete button if it has `remove`, which asks for confirmation unless `confirmDelete` is off.

- A change is sent to the source, and the grid then shows the row the source returns. An edited row sends only the values that changed; a new row sends every value it has.
- A value that its column type can't save, such as text in a number column, is marked as invalid and explained under the rows, and nothing is sent until it is corrected.
- Enter in a text field saves the row and Escape cancels the edit. While a row is being edited, sorting, filtering and paging are disabled.
- The `rowKey` column (`id`) is shown in the editor but can't be changed, because the source assigns it.
- An error is shown under the rows, with a **Retry** button if the rows couldn't be loaded, or if `read` returned something other than a list of rows (an API's wrapper, `{ data: [...] }`, for example: unwrap it in a source of your own).

`restSource(url)` is a source for a REST collection of JSON rows:

| Action        | Request                                                                |
| ------------- | ---------------------------------------------------------------------- |
| Load the rows | `GET url`                                                              |
| Add a row     | `POST url` with the row                                                |
| Edit a row    | `PATCH url/{key}` with the changed values, or `PUT` with the whole row |
| Delete a row  | `DELETE url/{key}`                                                     |

```tsx
// Created once: the grid loads its rows again whenever it is given a new source object.
const people = restSource('/api/people', {
  init: { headers: { Authorization: `Bearer ${token}` } },
})

<DataGrid aria-label="People" source={people} />
```

| Option  | Default   |                                                                |
| ------- | --------- | -------------------------------------------------------------- |
| `key`   | `'id'`    | The property appended to the URL to address a row.             |
| `edit`  | `'patch'` | `'patch'` sends the changed properties, `'put'` the whole row. |
| `init`  |           | Added to every request: headers, credentials and the like.     |
| `fetch` | `fetch`   | The `fetch` function used to send requests.                    |

A query string in the URL is added to every request, after the row's key where there is one (`/api/people/3?expand=orders`). The key is URL-encoded. A change to a row that has no key, or whose key is `.` or `..`, fails without sending a request.

For any other API, write your own `DataGridSource`: an object with `read(signal)`, which resolves to the rows, and any of `create(row)`, `update(row, changes)` and `remove(row)`. Sorting, filtering and paging are done in the browser, on the rows `read` returns.

By default a child collection shows the nested rows as they were loaded with their parent. If the child rows have their own API, `childSource(parent, collection)` can return a source for them. It is called once, when the row is expanded. URL-encode any value from a row that you put into a URL yourself:

```tsx
<DataGrid
  source={customers}
  childSource={(customer) => restSource(`/api/customers/${encodeURIComponent(customer.id)}/orders`)}
/>
```

## Props and properties

Takes every [Card](card.md) prop except `padding`, including `ref`; `aria-label` names the table. It also takes:

| Prop            | Default       |                                                                                                                                                                                                       |
| --------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`          |               | The rows, as JSON. Give this or `source`, not both.                                                                                                                                                   |
| `source`        |               | Used instead of `data`: where the rows are loaded from and changes are saved to. Create it once (outside render, or with `useMemo`).                                                                  |
| `columns`       |               | `{ header?, type?, options?, showFilter?, summary?, mask?, saveMask?, currency?, width?, resizable? }` keyed by property name, for columns and child collections (see [Column types](#column-types)). |
| `resizable`     | `true`        | Whether columns can be resized. `false` removes the resize handles and the fit button. A column's own `resizable` overrides it.                                                                       |
| `showFilter`    | `true`        | Whether columns have a filter under their header. A column's own `showFilter` overrides it.                                                                                                           |
| `showSummary`   | `false`       | Whether a summary row totals every number column except the row key (see [Summary row](#summary-row)).                                                                                                |
| `locale`        | the browser's | A BCP 47 language tag, such as `'en-GB'` or `'fr-FR'` (see [Locale and money](#locale-and-money)).                                                                                                    |
| `labels`        |               | The grid's own text, to replace its English defaults (see [Labels](#labels)).                                                                                                                         |
| `currency`      |               | The currency of money columns that don't set their own, as an ISO 4217 code such as `'EUR'`.                                                                                                          |
| `confirmDelete` | `true`        | Whether a row's delete button asks for confirmation. Escape cancels it.                                                                                                                               |
| `rowKey`        | `'id'`        | The property that uniquely identifies a row. A row without one, or with the same key as an earlier row, is identified by its position instead.                                                        |
| `pageSize`      | `0`           | Rows per page; `0` puts every row on one page.                                                                                                                                                        |
| `rowHeight`     | `44`          | Height of a row, in px.                                                                                                                                                                               |
| `detailHeight`  | `320`         | Height of an expanded row's child collections, in px.                                                                                                                                                 |
| `childSource`   |               | Returns a source for a row's child collection, or undefined to show the nested rows as loaded.                                                                                                        |

| Property                           | Default   |                                                                                                                                                                              |
| ---------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--prism-data-grid-height`         | `480px`   | Height of the grid.                                                                                                                                                          |
| `--prism-data-grid-column-min`     | `120px`   | Minimum width of a column with no width of its own; once the columns can shrink no further, the grid scrolls sideways. A column can still be dragged narrower, down to 48px. |
| `--prism-data-grid-expander-width` | `44px`    | Width of the column of expand buttons.                                                                                                                                       |
| `--prism-data-grid-actions-width`  | `84px`    | Width of the column of edit and delete buttons.                                                                                                                              |
| `--prism-data-grid-cell-padding`   | `12px`    | Padding at the sides of a cell.                                                                                                                                              |
| `--prism-data-grid-fade`           | `32px`    | Width of the fade at a side where more columns can be scrolled into view, and height of the fade on the rows at the top and bottom.                                          |
| `--prism-data-grid-line`           |           | Lines between rows: the text colour at 14%.                                                                                                                                  |
| `--prism-data-grid-hover`          |           | Tint of a hovered or edited row: the text colour at 6%.                                                                                                                      |
| `--prism-data-grid-detail-bg`      |           | Tint behind a row's child collections: the text colour at 4%.                                                                                                                |
| `--prism-data-grid-error`          | `#c62f2f` | Colour of an error (`#ff8a8a` in dark mode).                                                                                                                                 |
| `--prism-data-grid-focus`          | `#6d7cff` | Focus ring of the header and icon buttons (`#9aa5ff` in dark mode).                                                                                                          |

The filters and editors are styled by the `--prism-textbox-*` properties, the card by the `--prism-card-*` properties, and the panels of the dropdowns, calendars and option filters by the `--prism-popup-*` properties.
