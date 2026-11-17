const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const APPROX = /^(about|abt\.?|approx\.?|around|circa|ca\.?|c\.|c|~|est\.?|cal\.?)\s*/i
const CANONICAL = /^(~)?(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/

export interface DateParts {
  approx: boolean
  year: number
  month: number | null
  day: number | null
}

function isLeap(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysIn(year: number, month: number) {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0
}

function monthFromName(name: string): number | null {
  const index = MONTHS.indexOf(name.slice(0, 3).toLowerCase())
  return index === -1 ? null : index + 1
}

function build(parts: DateParts): string | null {
  const { year, month, day, approx } = parts
  if (!Number.isInteger(year) || year < 1 || year > 9999) return null
  if (month !== null && (month < 1 || month > 12)) return null
  if (day !== null && (month === null || day < 1 || day > daysIn(year, month))) return null
  let out = String(year).padStart(4, '0')
  if (month !== null) out += `-${String(month).padStart(2, '0')}`
  if (day !== null) out += `-${String(day).padStart(2, '0')}`
  return approx ? `~${out}` : out
}

function parseExact(text: string, approx: boolean): string | null {
  let m = /^(\d{1,4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(text)
  if (m) {
    return build({
      approx,
      year: Number(m[1]),
      month: m[2] ? Number(m[2]) : null,
      day: m[3] ? Number(m[3]) : null,
    })
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text)
  if (m) return build({ approx, year: Number(m[3]), month: Number(m[2]), day: Number(m[1]) })
  m = /^(\d{1,2})[/.](\d{4})$/.exec(text)
  if (m) return build({ approx, year: Number(m[2]), month: Number(m[1]), day: null })
  m = /^(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{1,4})$/i.exec(text)
  if (m) {
    const month = monthFromName(m[2] ?? '')
    if (month === null) return null
    return build({ approx, year: Number(m[3]), month, day: Number(m[1]) })
  }
  m = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{1,4})$/i.exec(text)
  if (m) {
    const month = monthFromName(m[1] ?? '')
    if (month === null) return null
    return build({ approx, year: Number(m[3]), month, day: Number(m[2]) })
  }
  m = /^([a-z]+)\.?,?\s+(\d{1,4})$/i.exec(text)
  if (m) {
    const month = monthFromName(m[1] ?? '')
    if (month === null) return null
    return build({ approx, year: Number(m[2]), month, day: null })
  }
  return null
}

export function parseDateInput(input: string): string | null {
  let text = input.trim()
  if (text === '') return ''
  let approx = false
  const prefix = APPROX.exec(text)
  if (prefix) {
    approx = true
    text = text.slice(prefix[0].length).trim()
  }
  return parseExact(text, approx)
}

export function isCanonicalDate(value: string): boolean {
  if (value === '') return true
  const parts = dateParts(value)
  return parts !== null && build(parts) === value
}

export function dateParts(value: string): DateParts | null {
  const m = CANONICAL.exec(value)
  if (!m) return null
  return {
    approx: m[1] === '~',
    year: Number(m[2]),
    month: m[3] ? Number(m[3]) : null,
    day: m[4] ? Number(m[4]) : null,
  }
}

export function formatDate(value: string): string {
  const parts = dateParts(value)
  if (!parts) return value
  const label = parts.month === null ? '' : `${MONTH_LABELS[parts.month - 1]} `
  const day = parts.day === null ? '' : `${parts.day} `
  return `${parts.approx ? 'c. ' : ''}${day}${label}${parts.year}`
}

export function yearOf(value: string): number | null {
  return dateParts(value)?.year ?? null
}

export function compareDates(a: string, b: string): number {
  const pa = dateParts(a)
  const pb = dateParts(b)
  if (!pa && !pb) return 0
  if (!pa) return 1
  if (!pb) return -1
  return pa.year - pb.year || (pa.month ?? 0) - (pb.month ?? 0) || (pa.day ?? 0) - (pb.day ?? 0)
}

export function toGedcomDate(value: string): string {
  const parts = dateParts(value)
  if (!parts) return ''
  const month = parts.month === null ? '' : `${MONTHS[parts.month - 1]?.toUpperCase()} `
  const day = parts.day === null ? '' : `${parts.day} `
  return `${parts.approx ? 'ABT ' : ''}${day}${month}${parts.year}`
}

export function fromGedcomDate(input: string): string {
  let text = input
    .trim()
    .replace(/^@#D[A-Z ]+@\s*/, '')
    .toUpperCase()
  let approx = false
  const range = /^(?:BET|FROM)\s+(.+?)\s+(?:AND|TO)\s+.+$/.exec(text)
  if (range?.[1]) {
    text = range[1]
    approx = true
  }
  const prefix = /^(ABT|EST|CAL|BEF|AFT|FROM|TO|INT)\s+/.exec(text)
  if (prefix) {
    approx = true
    text = text.slice(prefix[0].length)
  }
  text = text.replace(/\s*\(.*\)$/, '')
  const parsed = parseExact(text, approx)
  return parsed ?? ''
}

export function ageOf(
  bornDate: string,
  diedDate: string | null,
  today: string = new Date().toISOString().slice(0, 10),
): { years: number; approx: boolean } | null {
  const born = dateParts(bornDate)
  if (!born || diedDate === null) return null
  const end = dateParts(diedDate || today)
  if (!end) return null
  let years = end.year - born.year
  const exact = born.month !== null && end.month !== null && born.day !== null && end.day !== null
  if (
    exact &&
    (end.month as number) * 100 + (end.day as number) <
      (born.month as number) * 100 + (born.day as number)
  ) {
    years -= 1
  }
  return { years, approx: !exact || born.approx || end.approx }
}
