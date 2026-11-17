import { describe, expect, test } from 'bun:test'
import { coupleRelationLabel } from '../src/kinship.ts'
import { applyCommand, emptyTree } from '../src/ops.ts'
import { buildIndex, centrePartner } from '../src/relations.ts'
import type { Command, Gender } from '../src/types.ts'

const people: [string, string, Gender][] = [
  ['alex', 'Alex', 'male'],
  ['niamh', 'Niamh Mary', 'female'],
  ['dad', 'Maricel', 'male'],
  ['mum', 'Mihaela', 'female'],
  ['ana', 'Ana-Maria', 'female'],
  ['tom', 'Tom', 'male'],
  ['carmel', 'Carmel', 'female'],
  ['nora', 'Nora', 'female'],
  ['aoife', 'Aoife', 'female'],
  ['sean', 'Seán', 'male'],
  ['ella', 'Ella', 'female'],
  ['son', 'Luca', 'male'],
  ['ex', 'Ex', 'female'],
]
const link = (childId: string, parentId: string): Command => ({
  type: 'addParentLink',
  link: { childId, parentId },
})
const pair = (a: string, b: string, ended = false): Command => ({
  type: 'addPartnership',
  partnership: { personAId: a, personBId: b, married: true, ended },
})
const commands: Command[] = [
  ...people.map(
    ([id, firstNames, gender]): Command => ({
      type: 'addPerson',
      person: { id, firstNames, gender },
    }),
  ),
  link('alex', 'dad'),
  link('alex', 'mum'),
  link('ana', 'dad'),
  link('ana', 'mum'),
  link('niamh', 'carmel'),
  link('carmel', 'nora'),
  link('aoife', 'carmel'),
  link('ella', 'aoife'),
  link('son', 'alex'),
  link('son', 'niamh'),
  pair('alex', 'ex', true),
  pair('alex', 'niamh'),
  pair('ana', 'tom'),
  pair('aoife', 'sean'),
]
const index = buildIndex(
  commands.reduce((d, c) => applyCommand(d, c).data, emptyTree({ name: 'T' })),
)

describe('centrePartner', () => {
  test('is the current partner, not a former one', () => {
    expect(centrePartner(index, 'alex')).toBe('niamh')
    expect(centrePartner(index, 'dad')).toBeNull()
  })
})

describe('coupleRelationLabel', () => {
  test.each([
    ['alex', null],
    ['niamh', null],
    ['dad', "Alex's father"],
    ['ana', "Alex's sister"],
    ['tom', "Alex's brother-in-law"],
    ['carmel', "Niamh's mother"],
    ['nora', "Niamh's grandmother"],
    ['aoife', "Niamh's sister"],
    ['sean', "Niamh's brother-in-law"],
    ['ella', "Niamh's niece"],
    ['son', 'Son'],
    ['ex', "Alex's ex-wife"],
  ])('%p is %p', (to, expected) => {
    expect(coupleRelationLabel(index, 'alex', 'niamh', to)).toBe(expected)
  })
})
