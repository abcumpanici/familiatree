import { describe, expect, test } from 'bun:test'
import {
  compareDates,
  formatDate,
  fromGedcomDate,
  parseDateInput,
  toGedcomDate,
  yearOf,
} from '../src/dates.ts'

describe('parseDateInput', () => {
  test.each([
    ['', ''],
    ['1952', '1952'],
    ['1952-03', '1952-03'],
    ['1952-03-14', '1952-03-14'],
    ['14/03/1952', '1952-03-14'],
    ['14.3.1952', '1952-03-14'],
    ['03/1952', '1952-03'],
    ['14 March 1952', '1952-03-14'],
    ['14 mar 1952', '1952-03-14'],
    ['March 14, 1952', '1952-03-14'],
    ['March 1952', '1952-03'],
    ['about 1900', '~1900'],
    ['c. 1900', '~1900'],
    ['circa 1900', '~1900'],
    ['~1900', '~1900'],
    ['abt 1900', '~1900'],
    ['  1931 ', '1931'],
    ['812', '0812'],
  ])('%p becomes %p', (input, expected) => {
    expect(parseDateInput(input)).toBe(expected)
  })

  test.each(['hello', '1952-13', '1952-02-30', '31/04/2001', '32 May 1990', '12345'])(
    '%p is not a date',
    (input) => {
      expect(parseDateInput(input)).toBeNull()
    },
  )

  test('accepts 29 February in a leap year only', () => {
    expect(parseDateInput('29/02/2000')).toBe('2000-02-29')
    expect(parseDateInput('29/02/1900')).toBeNull()
  })
})

describe('formatDate', () => {
  test.each([
    ['', ''],
    ['1952', '1952'],
    ['1952-03', 'Mar 1952'],
    ['1952-03-04', '4 Mar 1952'],
    ['~1900', 'c. 1900'],
  ])('%p shows as %p', (input, expected) => {
    expect(formatDate(input)).toBe(expected)
  })
})

describe('GEDCOM dates', () => {
  test.each([
    ['1952-03-14', '14 MAR 1952'],
    ['1952-03', 'MAR 1952'],
    ['1952', '1952'],
    ['~1900', 'ABT 1900'],
  ])('%p and %p convert both ways', (date, gedcom) => {
    expect(toGedcomDate(date)).toBe(gedcom)
    expect(fromGedcomDate(gedcom)).toBe(date)
  })

  test.each([
    ['BEF 1900', '~1900'],
    ['AFT 1900', '~1900'],
    ['EST 1850', '~1850'],
    ['BET 1850 AND 1860', '~1850'],
    ['@#DGREGORIAN@ 2 JAN 1901', '1901-01-02'],
    ['nonsense', ''],
  ])('reads %p as %p', (gedcom, date) => {
    expect(fromGedcomDate(gedcom)).toBe(date)
  })
})

test('yearOf and compareDates', () => {
  expect(yearOf('~1900')).toBe(1900)
  expect(yearOf('')).toBeNull()
  expect(compareDates('1950', '1950-01-01')).toBeLessThan(0)
  expect(compareDates('1951', '1950-12-31')).toBeGreaterThan(0)
  expect(compareDates('', '1950')).toBeGreaterThan(0)
})
