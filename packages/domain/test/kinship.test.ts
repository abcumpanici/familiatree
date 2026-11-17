import { describe, expect, test } from 'bun:test'
import { ageOf } from '../src/dates.ts'
import { relationLabel } from '../src/kinship.ts'
import { applyCommand, emptyTree } from '../src/ops.ts'
import { buildIndex } from '../src/relations.ts'
import { sampleFamily } from '../src/sample.ts'
import type { Command, Gender } from '../src/types.ts'

const index = buildIndex(sampleFamily())
const rel = (from: string, to: string) => relationLabel(index, from, to)

describe('relationLabel', () => {
  test.each([
    ['daniel', 'daniel', null],
    ['daniel', 'thomas', 'Father'],
    ['daniel', 'margaret', 'Mother'],
    ['daniel', 'arthur', 'Grandfather'],
    ['noah', 'arthur', 'Great-grandfather'],
    ['thomas', 'daniel', 'Son'],
    ['arthur', 'noah', 'Great-grandson'],
    ['arthur', 'mia', 'Great-granddaughter'],
    ['daniel', 'lena', 'Wife'],
    ['lena', 'daniel', 'Husband'],
    ['thomas', 'margaret', 'Ex-wife'],
    ['clare', 'sean', 'Partner'],
    ['daniel', 'sarah', 'Half-sister'],
    ['sarah', 'james', 'Brother'],
    ['thomas', 'james', 'Adopted son'],
    ['james', 'helen', 'Adoptive mother'],
    ['daniel', 'helen', 'Stepmother'],
    ['helen', 'daniel', 'Stepson'],
    ['lena', 'thomas', 'Father-in-law'],
    ['thomas', 'lena', 'Daughter-in-law'],
    ['daniel', 'clare', 'Aunt'],
    ['clare', 'daniel', 'Nephew'],
    ['daniel', 'aoife', 'Cousin'],
    ['noah', 'aoife', 'Cousin once removed'],
    ['noah', 'ella', 'Second cousin'],
    ['noah', 'clare', 'Great-aunt'],
    ['clare', 'noah', 'Great-nephew'],
    ['sarah', 'lena', 'Sister-in-law'],
    ['lena', 'sarah', 'Sister-in-law'],
    ['sarah', 'walter', 'Grandfather'],
    ['daniel', 'walter', null],
  ])('%p sees %p as %p', (from, to, expected) => {
    expect(rel(from, to)).toBe(expected)
  })

  test('uses neutral words when the gender is not known', () => {
    const people: [string, Gender][] = [
      ['me', 'unknown'],
      ['p', 'other'],
      ['kid', 'unknown'],
    ]
    const commands: Command[] = [
      ...people.map(
        ([id, gender]): Command => ({
          type: 'addPerson',
          person: { id, firstNames: id, gender },
        }),
      ),
      { type: 'addParentLink', link: { childId: 'me', parentId: 'p' } },
      { type: 'addParentLink', link: { childId: 'kid', parentId: 'me' } },
    ]
    const data = commands.reduce((d, c) => applyCommand(d, c).data, emptyTree({ name: 'T' }))
    const i = buildIndex(data)
    expect(relationLabel(i, 'me', 'p')).toBe('Parent')
    expect(relationLabel(i, 'me', 'kid')).toBe('Child')
    expect(relationLabel(i, 'kid', 'p')).toBe('Grandparent')
  })
})

describe('ageOf', () => {
  test.each([
    ['1950-06-18', '', '2026-06-17', { years: 75, approx: false }],
    ['1950-06-18', '', '2026-06-18', { years: 76, approx: false }],
    ['1921-04-02', '1994-11-20', '2026-01-01', { years: 73, approx: false }],
    ['1950', '', '2026-01-01', { years: 76, approx: true }],
    ['~1918', '1980', '2026-01-01', { years: 62, approx: true }],
  ])('born %p, died %p, on %p', (born, died, today, expected) => {
    expect(ageOf(born, died, today)).toEqual(expected)
  })

  test('is unknown without a birth year or with a death but no date', () => {
    expect(ageOf('', '', '2026-01-01')).toBeNull()
    expect(ageOf('1950', null, '2026-01-01')).toBeNull()
  })
})
