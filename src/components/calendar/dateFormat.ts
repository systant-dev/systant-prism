import { once } from '../../shared'
import { makeDay, orderDays, sameDay, type CalendarRange } from './calendarDate'

/**
 * How a date is written: either a pattern of `d dd`, `M MM MMM MMMM`, `yy yyyy` and
 * `EEE EEEE`, whose names are in the locale and in which anything in 'single
 * quotes' is taken as it stands, or Intl.DateTimeFormat's own options, whose order
 * and punctuation are the locale's.
 */
export type CalendarDateFormat = string | Omit<Intl.DateTimeFormatOptions, 'calendar' | 'timeZone'>

type Field = 'day' | 'month' | 'year' | 'weekday'

/** A stretch of a written date: a field, or for null the text between fields. */
interface Segment {
  field: Field | null
  text: string
}

const TOKENS: Record<string, Intl.DateTimeFormatOptions> = {
  d: { day: 'numeric' },
  dd: { day: '2-digit' },
  M: { month: 'numeric' },
  MM: { month: '2-digit' },
  MMM: { month: 'short' },
  MMMM: { month: 'long' },
  yy: { year: '2-digit' },
  yyyy: { year: 'numeric' },
  EEE: { weekday: 'short' },
  EEEE: { weekday: 'long' },
}

const PATTERN = /('[^']*'|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE)/

/**
 * A formatter on the Gregorian calendar, whatever the locale's own. The month grid
 * is Gregorian, so in a locale that defaults to another (Persian, Buddhist) the
 * field would otherwise show a different year or month to the one on the grid.
 */
export function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  // Made once for each locale and options: they are slow to make, and a pattern's
  // every field asks for one each time a date is written.
  return once(
    formatters,
    `${locale}|${JSON.stringify(options)}`,
    () => new Intl.DateTimeFormat(locale, { ...options, calendar: 'gregory' }),
  )
}

const formatters = new Map<string, Intl.DateTimeFormat>()

/** The one field of a date, without what its locale writes around it (Japanese has 4日 for a lone day). */
export function fieldText(formatter: Intl.DateTimeFormat, date: Date, field: Field) {
  return formatter.formatToParts(date).find((part) => part.type === field)?.value ?? ''
}

function isField(type: string): type is Field {
  return type === 'day' || type === 'month' || type === 'year' || type === 'weekday'
}

// A month's name can take a different form beside a day (Russian's 4 ноября, but
// ноябрь alone), so a pattern with a day in it asks for that form.
function patternSegments(date: Date, pattern: string, locale: string): Segment[] {
  const pieces = pattern.split(PATTERN)
  const hasDay = pieces.some((piece, at) => at % 2 === 1 && TOKENS[piece]?.day)
  return pieces.map((piece, at) => {
    if (at % 2 === 0) return { field: null, text: piece }
    if (piece.startsWith("'")) return { field: null, text: piece.slice(1, -1) || "'" }
    const options = TOKENS[piece]
    const field = Object.keys(options)[0] as Field
    const named = options.month === 'short' || options.month === 'long'
    const formatter = dateFormatter(locale, named && hasDay ? { ...options, day: 'numeric' } : options)
    return { field, text: fieldText(formatter, date, field) }
  })
}

function segments(date: Date, format: CalendarDateFormat, locale: string): Segment[] {
  if (typeof format === 'string') return patternSegments(date, format, locale)
  return dateFormatter(locale, format)
    .formatToParts(date)
    .map(({ type, value }) => ({ field: isField(type) ? type : null, text: value }))
}

/** A date as `format` writes it in `locale`. */
export function formatDate(date: Date, format: CalendarDateFormat, locale: string) {
  return segments(date, format, locale)
    .map((segment) => segment.text)
    .join('')
}

// Spaces, punctuation, symbols and the invisible marks that keep right-to-left
// dates in order: anything of the sort is as good as any other, so 4-11-2026 reads
// as 4/11/2026.
const GAP_MARK = '[\\s\\p{P}\\p{S}\\p{Cf}]'
const GAP = `${GAP_MARK}*`
const WORD = /[^\s\p{P}\p{S}\p{Cf}]+/gu

/**
 * The longest text read as a date, in characters: several times what a locale writes
 * one in, in full, weekday and all (about 40). What is typed is matched against a
 * pattern in which a space or a dot can still belong to more than one part, a weekday
 * or the gap after it, and the longer the text, the more ways there are to try: a page
 * of text pasted into the field by mistake is turned down unread.
 */
const LONGEST_TYPED = 200

// The words in the text between fields, such as the "de" of 4 de noviembre, any of
// which may be left out. They hold no punctuation or symbols, so nothing in them
// needs escaping. A gap is written once before them and once after each, and never
// two side by side: two would share a run of spaces between them in as many ways as
// it has spaces, four in as many as its cube, and each way would be tried in turn.
// `required`: where the format puts something between two fields, something has to
// be there, a gap or one of the words, or a run of digits could be cut up anywhere:
// 04/11 as 0/4/11, and the 20 of 2026 taken for the end of a month's name.
function literalSource(words: readonly string[], required: boolean) {
  const source = `${GAP}${words.map((word) => `(?:${word}${GAP})?`).join('')}`
  return required ? `(?=${[GAP_MARK, ...words].join('|')})${source}` : source
}

/** A stretch of a format as it is read: a field, or the words of all the text before the next one. */
interface Stretch {
  field: Field | null
  words: string[]
}

/**
 * A format's segments as they are read: each run of text between fields as one, so
 * that it is one gap however many pieces the format wrote it in (a space, 'de' and
 * a space in d 'de' MMMM).
 */
function stretches(parts: readonly Segment[]): Stretch[] {
  const read: Stretch[] = []
  for (const { field, text } of parts) {
    const words = field ? [] : (text.match(WORD) ?? [])
    const last = read[read.length - 1]
    if (!field && last && !last.field) last.words.push(...words)
    else read.push({ field, words })
  }
  return read
}

function isDateField(segment: Pick<Segment, 'field'> | undefined) {
  return !!segment?.field && segment.field !== 'weekday'
}

const FIELD_SOURCES: Record<Field, string> = {
  day: '(\\d{1,2})',
  // A number, with or without the 月 of Japanese and Chinese, or a name, which
  // Vietnamese ends in a number: thg 11. A name starts with a letter and may hold dots
  // from there on (nov., sept.): dots before it are the gap's, or a run of them could
  // be shared out between the two in as many ways as it has dots.
  month: '(\\d{1,2}\\p{L}?|[\\p{L}\\p{M}][\\p{L}\\p{M}.]*(?: \\d{1,2})?)',
  year: '(\\d{1,4})',
  // Not held on to: it follows from the date. It can be two words, as in Hebrew.
  weekday: '(?:[\\p{L}\\p{M}.\\s]*)',
}

/**
 * A weekday that comes after a gap, as nearly all do: it starts with a letter, or isn't
 * there at all, as the gap has already taken any spaces and dots before it. Left to
 * take them too, the two share a run of them out in as many ways as it has characters,
 * and with a month's dots doing the same further on, a hundred characters of dots and
 * spaces were still being tried after six minutes.
 */
const WEEKDAY_AFTER_GAP = '(?:[\\p{L}\\p{M}][\\p{L}\\p{M}.\\s]*)?'

// The dot of a short month, or Hebrew's geresh.
function withoutMark(name: string) {
  return name.replace(/\p{P}+$/u, '')
}

// The month going by `name` in `locale`, in any form it is written, if there is one.
function monthNamed(name: string, locale: string) {
  const { compare } = new Intl.Collator(locale, { sensitivity: 'base' })
  const forms = (['long', 'short'] as const).flatMap((month) => [
    dateFormatter(locale, { month }),
    dateFormatter(locale, { month, day: 'numeric' }),
  ])
  return Array.from({ length: 12 }, (_, month) => month).find((month) =>
    forms.some((form) => compare(withoutMark(fieldText(form, makeDay(2000, month, 15), 'month')), name) === 0),
  )
}

function monthOf(text: string, locale: string) {
  return /^\d+$/.test(text) ? Number(text) - 1 : (monthNamed(withoutMark(text), locale) ?? -1)
}

// Two digits of a year are the one nearest now, up to twenty years ahead.
function yearOf(text: string) {
  const year = Number(text)
  if (text.length > 2) return year
  const now = new Date().getFullYear()
  const guess = now - (now % 100) + year
  return guess > now + 20 ? guess - 100 : guess
}

/**
 * The day in `typed`, read as `format` would write it in `locale`, or null if it
 * isn't one: the fields must come in the format's order, and all of day, month and
 * year be there, but it needn't be written exactly so. Single digits, a two-digit
 * year, any punctuation, a month by name or number in any case and with or without
 * its accents, and digits of the locale's own or Latin ones will all do.
 */
export function parseDate(typed: string, format: CalendarDateFormat, locale: string) {
  const text = typed.trim()
  if (text.length > LONGEST_TYPED) return null
  const parts = stretches(segments(makeDay(2000, 10, 22), format, locale).filter((part) => part.field || part.text))
  const fields = parts.filter(isDateField).map(({ field }) => field)
  const source = parts
    .map(({ field, words }, at) => {
      if (field === 'weekday' && !parts[at - 1]?.field) return WEEKDAY_AFTER_GAP
      if (field) return FIELD_SOURCES[field]
      return literalSource(words, isDateField(parts[at - 1]) && isDateField(parts[at + 1]))
    })
    .join('')
  const digits = new Intl.NumberFormat(locale, { useGrouping: false })
  const own = Array.from({ length: 10 }, (_, digit) => digits.format(digit))
  const latin = text.replace(/\p{Nd}/gu, (digit) => (own.includes(digit) ? String(own.indexOf(digit)) : digit))

  // Text at either end brings its own gap, and a field there is given one.
  const before = parts[0]?.field === null ? '' : GAP
  const after = parts[parts.length - 1]?.field === null ? '' : GAP
  const match = new RegExp(`^${before}${source}${after}$`, 'iu').exec(latin)
  if (!match) return null
  const found: Partial<Record<Field, number>> = {}
  fields.forEach((field, at) => {
    const value = match[at + 1]
    found[field!] = field === 'year' ? yearOf(value) : field === 'month' ? monthOf(value, locale) : Number(value)
  })
  const { year, month, day } = found
  if (year === undefined || month === undefined || day === undefined) return null
  const date = makeDay(year, month, day)
  // Anything past the end of a month has rolled over into the next.
  return date.getMonth() === month && date.getDate() === day ? date : null
}

/** A range as `format` writes its two days, or the one day alone, either side of `separator`. */
export function formatRange(
  { start, end }: CalendarRange,
  format: CalendarDateFormat,
  locale: string,
  separator: string,
) {
  const first = formatDate(start, format, locale)
  return sameDay(start, end) ? first : `${first}${separator}${formatDate(end, format, locale)}`
}

/**
 * The range in `typed`, or null if it isn't one: two days read as parseDate reads
 * them, either way round, with `separator` between them, on its own or spaced, or a
 * hyphen with spaces round it, or one day alone, which is a range of that day.
 */
export function parseRange(typed: string, format: CalendarDateFormat, locale: string, separator: string) {
  for (const between of new Set([separator, separator.trim(), ' - '])) {
    const parts = typed.split(between)
    if (parts.length !== 2) continue
    const start = parseDate(parts[0], format, locale)
    const end = parseDate(parts[1], format, locale)
    if (start && end) return orderDays(start, end)
  }
  const day = parseDate(typed, format, locale)
  return day && { start: day, end: day }
}
