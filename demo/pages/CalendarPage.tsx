import { useState, type CSSProperties } from 'react'
import { Calendar, Card, type CalendarRange } from '../../src'
import { DemoPage, Section } from '../layout'

const field: CSSProperties = { display: 'grid', gap: 6, marginTop: 12 }

const full: CSSProperties = { width: '100%' }

const today = new Date()
const inDays = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + days)

// The date lives in this component's state rather than the calendar's, and is shown under it.
function Controlled() {
  const [value, setValue] = useState<Date | null>(inDays(7))
  return (
    <>
      <h3 style={{ marginTop: 0 }}>Controlled</h3>
      <p>
        With <code>value</code> and <code>onChange</code>, your own state holds the date. The line below reads it.
      </p>
      <Calendar aria-label="Delivery" value={value} onChange={setValue} style={full} />
      <p style={{ marginBottom: 0 }}>{value ? `Selected: ${value.toDateString()}` : 'No date selected'}</p>
    </>
  )
}

// The same for a range, with the number of days in it shown under it.
function ControlledRange() {
  const [dates, setDates] = useState<CalendarRange | null>(null)
  const days = dates && Math.round((dates.end.getTime() - dates.start.getTime()) / 86400000) + 1
  return (
    <>
      <h3 style={{ marginTop: 0 }}>Controlled</h3>
      <p>
        With <code>range</code>, <code>value</code> is a <code>{'{ start, end }'}</code> pair. The line below counts its
        days.
      </p>
      <Calendar aria-label="Stay" range value={dates} onChange={setDates} placeholder="Pick your dates" style={full} />
      <p style={{ marginBottom: 0 }}>{days ? `${days} day${days === 1 ? '' : 's'} selected` : 'No dates selected'}</p>
    </>
  )
}

export function CalendarPage() {
  return (
    <DemoPage
      name="Calendar"
      intro={
        <p style={{ marginTop: 0 }}>
          A date field: type a date, or pick one from the month that opens in a Popup under the field. It follows the
          browser's language unless given a <code>locale</code>, which sets the order and names of the parts of a date,
          the numerals and the first day of the week. <code>dateFormat</code> sets how the field shows and reads a date,
          and <code>startDate</code> and <code>endDate</code> limit which days can be picked. From the field, the down
          arrow moves into the month. There the arrow keys move between days, Page Up and Page Down change the month,
          and with Shift they change the year. Give it an <code>aria-label</code>, or put it in a{' '}
          <code>&lt;label&gt;</code> with its text.
        </p>
      }
      demos={
        <>
          <Section title="Examples">
            {/* Directly on the backdrop, the same as on the Textbox page */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', alignSelf: 'start' }}>
              <Calendar aria-label="Date" placeholder="Pick a date" />
            </div>
            <Card>
              <Controlled />
            </Card>
          </Section>
          <Section title="The year view">
            <Card>
              <p style={{ marginTop: 0 }}>
                Click the month name at the top of the calendar to see the whole year. The arrows there change the year
                by one or by ten, and picking a month shows that month. The button under the days goes back to today.
              </p>
              <label style={field}>
                Date of birth
                <Calendar startDate={new Date(1900, 0, 1)} endDate={inDays(0)} placeholder="Pick a date" style={full} />
              </label>
            </Card>
          </Section>
          <Section title="range" column={340}>
            <Card>
              <p style={{ marginTop: 0 }}>
                Drag across the days to pick a range, holding the pointer over a month arrow to change month as you
                drag. Or click one day, then Shift-click another, which can be in a different month. From the keyboard,
                Shift with the arrow keys extends the range.
              </p>
              <Calendar aria-label="Dates" range placeholder="Pick your dates" style={full} />
            </Card>
            <Card>
              <ControlledRange />
            </Card>
            <Card>
              <label style={field}>
                Limited to the next 30 days
                <Calendar range startDate={inDays(0)} endDate={inDays(30)} placeholder="Pick your dates" style={full} />
              </label>
              <label style={field}>
                dd/MM/yyyy, with “ to ” as the separator
                <Calendar
                  range
                  dateFormat="dd/MM/yyyy"
                  rangeSeparator=" to "
                  defaultValue={{ start: inDays(2), end: inDays(9) }}
                  style={full}
                />
              </label>
            </Card>
          </Section>
          <Section title="startDate and endDate">
            <Card>
              <label style={field}>
                Both: the next 30 days
                <Calendar startDate={inDays(0)} endDate={inDays(30)} placeholder="Pick a date" style={full} />
              </label>
              <label style={field}>
                startDate only: today or later
                <Calendar startDate={inDays(0)} placeholder="Pick a date" style={full} />
              </label>
              <label style={field}>
                endDate only: today or earlier
                <Calendar endDate={inDays(0)} placeholder="Pick a date" style={full} />
              </label>
            </Card>
          </Section>
          <Section title="dateFormat">
            <Card>
              <label style={field}>
                dd/MM/yyyy
                <Calendar dateFormat="dd/MM/yyyy" defaultValue={today} style={full} />
              </label>
              <label style={field}>
                yyyy-MM-dd
                <Calendar dateFormat="yyyy-MM-dd" defaultValue={today} style={full} />
              </label>
              <label style={field}>
                EEE d MMMM yyyy
                <Calendar dateFormat="EEE d MMMM yyyy" defaultValue={today} style={full} />
              </label>
              <label style={field}>
                {'{ dateStyle: "long" }'}
                <Calendar dateFormat={{ dateStyle: 'long' }} defaultValue={today} style={full} />
              </label>
            </Card>
          </Section>
          <Section title="locale">
            <Card>
              <label style={field}>
                en-US, where the week starts on Sunday
                <Calendar locale="en-US" defaultValue={today} style={full} />
              </label>
              <label style={field}>
                de-DE
                <Calendar locale="de-DE" defaultValue={today} style={full} />
              </label>
              <label style={field}>
                ja-JP
                <Calendar locale="ja-JP" defaultValue={today} style={full} />
              </label>
              <label style={field} dir="rtl">
                ar-EG, right to left
                <Calendar locale="ar-EG" defaultValue={today} style={full} />
              </label>
            </Card>
          </Section>
          <Section title="Disabled and read-only">
            <Card>
              <label style={field}>
                Disabled
                <Calendar disabled defaultValue={today} style={full} />
              </label>
              <label style={field}>
                Read-only
                <Calendar readOnly defaultValue={today} style={full} />
              </label>
            </Card>
          </Section>
        </>
      }
      props={[
        ['range', 'boolean', 'false', 'Pick a range of days instead of one day, by dragging or with Shift.'],
        [
          'value',
          'Date | null',
          '',
          'The selected day, or null for none. Leave it out and the calendar keeps track of the date itself.',
        ],
        ['', 'CalendarRange | null', '', 'With range: the selected days, as { start, end }.'],
        ['defaultValue', 'Date | null', 'null', 'The day selected at first, when value is left out.'],
        ['', 'CalendarRange | null', '', 'With range: the days selected at first.'],
        [
          'onChange',
          '(value: Date | null) => void',
          '',
          'Called with the selected day, as local midnight at its start, or with null when the field is cleared.',
        ],
        ['', '(value: CalendarRange | null) => void', '', 'With range: called with both days, each as local midnight.'],
        ['rangeSeparator', 'string', "' – '", 'The text between the two dates of a range, both shown and typed.'],
        ['startDate', 'Date', '', 'The earliest day that can be picked, inclusive. Left out, there is no limit.'],
        ['endDate', 'Date', '', 'The latest day that can be picked, inclusive. Left out, there is no limit.'],
        [
          'dateFormat',
          'string | Intl.DateTimeFormatOptions',
          "{ dateStyle: 'medium' }",
          "How the field shows a date and reads a typed one: a pattern made of d dd M MM MMM MMMM yy yyyy EEE EEEE, with literal text in 'quotes', or a set of Intl options.",
        ],
        ['locale', 'string', "the browser's", "A BCP 47 language tag to use instead of the browser's language."],
        ['previousMonthLabel', 'string', "the locale's", 'Accessible name of the previous-month button.'],
        ['nextMonthLabel', 'string', "the locale's", 'Accessible name of the next-month button.'],
        ['previousYearLabel', 'string', "the locale's", "Accessible name of the year view's previous-year button."],
        ['nextYearLabel', 'string', "the locale's", "Accessible name of the year view's next-year button."],
        ['previousDecadeLabel', 'string', "the locale's", "Accessible name of the year view's back-ten-years button."],
        ['nextDecadeLabel', 'string', "the locale's", "Accessible name of the year view's forward-ten-years button."],
        ['todayLabel', 'string', "the locale's", 'The text of the button that goes back to today.'],
        ['clearLabel', 'string', "'Clear'", 'Accessible name of the clear button.'],
        [
          'refract',
          'boolean',
          'true',
          'Glass effect on the month panel: blurs the backdrop and bends it at the edges.',
        ],
        [
          'readableText',
          'boolean',
          'true',
          "Automatic text colour: the page's text colour inside a GlassBackdrop, and on an opaque background a colour adjusted, if need be, to stay readable.",
        ],
        [
          'readableSelection',
          'boolean',
          'true',
          "Automatic colours for selected text: the page's selection colours inside a GlassBackdrop, and elsewhere a highlight adjusted to stand out and keep its text readable.",
        ],
        [
          'className, style',
          '',
          '',
          'Applied to the outermost element, so a width or a custom property affects the whole field.',
        ],
        ['', '', '', 'Every other native <input> prop, ref included, is passed to the input. Give it a label.'],
      ]}
      customProperties={[
        ['--prism-calendar-day-size', '36px', "The width and height of a day's cell, and of the arrow buttons."],
        [
          '--prism-calendar-day-gap',
          '4px',
          'The space between days. It comes out of the cells, which stay the same size.',
        ],
        ['--prism-calendar-day-radius', '10px', "Corner radius of a day's highlight."],
        ['--prism-calendar-month-height', '44px', 'The height of a row of months in the year view.'],
        ['--prism-calendar-month-gap-x', '8px', 'The space between months in a row.'],
        ['--prism-calendar-month-gap-y', '4px', 'The space between rows of months. It comes out of the row height.'],
        ['--prism-calendar-year-offset-y', '4px', 'The gap between the month name and the year view below it.'],
        [
          '--prism-calendar-year-inset',
          '4px',
          "How far the year view's edge extends past the start of the month name.",
        ],
        ['--prism-calendar-heading-padding', '14px', 'The space on each side of the month name, inside its highlight.'],
        ['--prism-calendar-today-height', '32px', 'The height of the today button.'],
        ['--prism-calendar-active-opacity', '0.12', 'Opacity of the highlight on a hovered day.'],
        ['--prism-calendar-hover-in-duration', '80ms', 'How long that highlight takes to fade in.'],
        ['--prism-calendar-hover-out-duration', '200ms', 'How long it takes to fade out.'],
        ['--prism-calendar-selected-opacity', '0.24', 'Opacity of the highlight on the selected day.'],
        ['--prism-calendar-range-opacity', '0.12', 'Opacity of the band behind the days of a range.'],
        ['--prism-calendar-range-width', '320px', 'The width of the field when range is set.'],
        ['--prism-calendar-weekday-opacity', '0.7', 'Opacity of the weekday names above the columns.'],
        ['--prism-calendar-outside-opacity', '0.6', 'Opacity of the days shown from the previous and next months.'],
        ['--prism-calendar-disabled-opacity', '0.3', "Opacity of a day or an arrow that can't be used."],
        ['--prism-textbox-*', '', 'The field itself: see Textbox.'],
        ['--prism-popup-*', '', 'The panel holding the month: see Popup.'],
        ['--prism-button-*', '', "The selected day's rim, glow and sheen: see Button."],
      ]}
    />
  )
}
