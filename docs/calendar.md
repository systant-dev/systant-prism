# Calendar

[← Back to the README](../README.md)

A date field: type a date, or pick one from a month shown in a `Popup` under the field. It is a [Textbox](textbox.md)'s pill with a calendar icon at its end.

```tsx
const [date, setDate] = useState<Date | null>(null)

<label>
  Delivery <Calendar value={date} onChange={setDate} startDate={new Date()} placeholder="Pick a date" />
</label>
```

A date is a local day. The time of day and time zone of a `Date` you pass in are ignored, and `onChange` receives local midnight at the start of the selected day. Nothing is converted through UTC, so a date never slips to the day before.

- **Language.** It follows the browser's language, or `locale`, which sets the order of a date's parts, the names and numerals in it, the first day of the week and the accessible names of its buttons. It always uses the Gregorian calendar. In right-to-left text the month and the arrow keys are mirrored. A server renders it in `en-US` unless it is given a `locale` (see [Server rendering](server-rendering.md)).
- **Typing.** A typed date is read using `dateFormat`, leniently: `4-11-26` is accepted for `dd/MM/yyyy`, and a month can be typed as a name or a number. It is applied when the field loses focus or on Enter. Text that isn't a date the calendar could pick is discarded, and emptying the field clears the value. Typing needs a format that has a day, a month and a year.
- **`startDate` and `endDate`** are the first and last days that can be picked, inclusive. Days outside them are disabled, and a typed date outside them is rejected. A `value` outside them is still shown.
- **The year view.** The month's heading is a button that opens the year with its twelve months under it, for moving a long way quickly. Picking a month shows that month; it never changes the value.
- **Today.** A button under the days takes the calendar back to the current month, without changing the value.

**`dateFormat`.** The default, `{ dateStyle: 'medium' }`, gives `4 Nov 2026` in `en-GB` and `Nov 4, 2026` in `en-US`. It accepts any `Intl.DateTimeFormat` options, in which case the locale decides the order and punctuation, or a pattern, in which case you decide the order and the locale still supplies the names:

| Pattern      | Output (`en-GB`)                        |
| ------------ | --------------------------------------- |
| `d` `dd`     | The day: `4`, `04`                      |
| `M` `MM`     | The month: `3`, `03`                    |
| `MMM` `MMMM` | The month's name: `Nov`, `November`     |
| `yy` `yyyy`  | The year: `26`, `2026`                  |
| `EEE` `EEEE` | The day of the week: `Wed`, `Wednesday` |
| `'text'`     | Literal text; `''` is a quote mark      |

**Ranges.** With `range` it picks a range of days, and `value`, `defaultValue` and `onChange` use a `CalendarRange`, `{ start, end }`, instead of a `Date`. A single day is a range whose `start` and `end` are the same.

```tsx
const [dates, setDates] = useState<CalendarRange | null>(null)

<Calendar range value={dates} onChange={setDates} aria-label="Dates" />
```

Click a day and then Shift-click another, changing month in between if need be, or drag across the days; holding a drag over a month arrow changes the month. On the keyboard, Shift with any key that moves between days extends the range. The field shows the two dates with `rangeSeparator` between them, and typed text is read the same way; a single typed date is a one-day range.

**The keyboard.** A press on the field or the icon opens the month and leaves the focus in the field, for typing. The down arrow opens the month, or moves the focus into it.

| Key                | In the month                                      | In the year view                           |
| ------------------ | ------------------------------------------------- | ------------------------------------------ |
| Arrow keys         | Move by a day or a week.                          | Move by a month or a row.                  |
| Home, End          | Go to the first or last day of the week.          | Go to January or December.                 |
| Page Up, Page Down | Move by a month. With Shift, by a year.           | Move by a year. With Shift, by ten.        |
| Enter, Space       | Pick the day. On the heading, open the year view. | Pick the month.                            |
| Shift and a key    | With `range`, extend the range.                   |                                            |
| Escape             | Close and return the focus to the field.          | Close and return the focus to the heading. |

It follows the ARIA date picker combobox pattern: the field is a `combobox` with a popup `dialog` containing a `grid` of labelled days.

It takes an `<input>`'s props and passes them, `ref` included, to the input, with these exceptions: `className` and `style` are applied to the outer pill, and `name`, `min` and `max` aren't accepted (`startDate` and `endDate` do the job of `min` and `max`). It has no label of its own: give it an `aria-label`, or put it in a `<label>` with its text. It also takes:

| Prop                                     | Default                                               |                                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`                                  |                                                       | The selected day, or `null` for none. With `range`, a `CalendarRange`. Left out, the calendar keeps track of the date itself.                        |
| `defaultValue`                           | `null`                                                | The day selected at first, when `value` is left out.                                                                                                 |
| `onChange`                               |                                                       | Called with the selected day, as local midnight at its start, or with `null` when the field is cleared. With `range`, called with a `CalendarRange`. |
| `range`                                  | `false`                                               | Pick a range of days instead of one day.                                                                                                             |
| `rangeSeparator`                         | `' – '`                                               | The text between the two dates of a range, both shown and typed.                                                                                     |
| `startDate`                              |                                                       | The earliest day that can be picked, inclusive.                                                                                                      |
| `endDate`                                |                                                       | The latest day that can be picked, inclusive.                                                                                                        |
| `dateFormat`                             | `{ dateStyle: 'medium' }`                             | How the field shows a date and reads a typed one: a pattern, or `Intl.DateTimeFormat` options.                                                       |
| `locale`                                 | The browser's                                         | A BCP 47 language tag.                                                                                                                               |
| `previousMonthLabel`, `nextMonthLabel`   | The locale's words for last and next month            | Accessible names of the month arrows.                                                                                                                |
| `previousYearLabel`, `nextYearLabel`     | The locale's words for last and next year             | Accessible names of the year view's arrows.                                                                                                          |
| `previousDecadeLabel`, `nextDecadeLabel` | The locale's words for ten years ago and in ten years | Accessible names of the year view's ten-year arrows.                                                                                                 |
| `todayLabel`                             | The locale's word for today                           | The text of the button that goes back to today.                                                                                                      |
| `clearLabel`                             | `'Clear'`                                             | Accessible name of the clear button.                                                                                                                 |
| `refract`                                | `true`                                                | Glass effect on the month panel: inside a `GlassBackdrop`, blurs the backdrop image and bends it at the edges.                                       |
| `readableText`                           | `true`                                                | Automatic text colour (see [Readable text colour](colours.md#readable-text-colour)).                                                                 |
| `readableSelection`                      | `true`                                                | Automatic colours for selected text (see [Readable selection colour](colours.md#readable-selection-colour)).                                         |

| Property                              | Default |                                                                                  |
| ------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `--prism-calendar-day-size`           | `36px`  | The width and height of a day's cell, and of the arrow buttons.                  |
| `--prism-calendar-day-gap`            | `4px`   | The space between days. It comes out of the cells, which stay the same size.     |
| `--prism-calendar-day-radius`         | `10px`  | Corner radius of a day's highlight.                                              |
| `--prism-calendar-month-height`       | `44px`  | The height of a row of months in the year view.                                  |
| `--prism-calendar-month-gap-x`        | `8px`   | The space between months in a row.                                               |
| `--prism-calendar-month-gap-y`        | `4px`   | The space between rows of months. It comes out of the row height.                |
| `--prism-calendar-year-offset-y`      | `4px`   | How far the year view is moved down from its position under the heading.         |
| `--prism-calendar-year-inset`         | `4px`   | How far the year view's edge extends past the start of the month's name.         |
| `--prism-calendar-heading-padding`    | `14px`  | The space on each side of the month's name, inside the heading's highlight.      |
| `--prism-calendar-today-height`       | `32px`  | The height of the today button.                                                  |
| `--prism-calendar-active-opacity`     | `0.12`  | Opacity of the highlight on a hovered day.                                       |
| `--prism-calendar-hover-in-duration`  | `80ms`  | How long that highlight takes to fade in.                                        |
| `--prism-calendar-hover-out-duration` | `200ms` | How long it takes to fade out.                                                   |
| `--prism-calendar-selected-opacity`   | `0.24`  | Opacity of the highlight on the selected day.                                    |
| `--prism-calendar-range-opacity`      | `0.12`  | Opacity of the band behind the days of a range.                                  |
| `--prism-calendar-range-width`        | `320px` | The width of the field when `range` is set, in place of `--prism-textbox-width`. |
| `--prism-calendar-weekday-opacity`    | `0.7`   | Opacity of the weekday names above the columns.                                  |
| `--prism-calendar-outside-opacity`    | `0.6`   | Opacity of the days shown from the previous and next months.                     |
| `--prism-calendar-disabled-opacity`   | `0.3`   | Opacity of a day or an arrow that can't be used.                                 |

The field is styled by the `--prism-textbox-*` properties, except `--prism-textbox-clear-size`, the panel by the `--prism-popup-*` properties, and the selected day by the `--prism-button-*` properties.
