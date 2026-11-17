import { describe, expect, test } from 'bun:test'
import { fromGedcom, toGedcom } from '../src/gedcom.ts'
import { displayName } from '../src/relations.ts'
import { sampleFamily } from '../src/sample.ts'
import { fromExportFile, toExportFile } from '../src/schema.ts'
import type { TreeData } from '../src/types.ts'

function shape(data: TreeData) {
  const name = new Map(data.people.map((p) => [p.id, displayName(p)]))
  return {
    people: data.people
      .map(
        ({
          firstNames,
          surname,
          birthSurname,
          gender,
          bornDate,
          bornPlace,
          died,
          diedDate,
          story,
        }) => ({
          firstNames,
          surname,
          birthSurname,
          gender,
          bornDate,
          bornPlace,
          died,
          diedDate,
          story,
        }),
      )
      .sort((a, b) => a.firstNames.localeCompare(b.firstNames)),
    links: data.parentLinks
      .map((l) => `${name.get(l.childId)} < ${name.get(l.parentId)} (${l.kind})`)
      .sort(),
    partnerships: data.partnerships
      .map(
        (p) =>
          `${[name.get(p.personAId), name.get(p.personBId)].sort().join(' + ')} ${p.married} ${p.startDate} ${p.ended} ${p.endDate}`,
      )
      .sort(),
  }
}

describe('JSON export file', () => {
  test('a round trip keeps everything and makes new ids', () => {
    const data = sampleFamily()
    const json = JSON.parse(JSON.stringify(toExportFile(data)))
    const back = fromExportFile(json)
    expect(shape(back)).toEqual(shape(data))
    expect(back.tree.id).not.toBe(data.tree.id)
    expect(back.people[0]?.id).not.toBe(data.people[0]?.id)
    const home = back.people.find((p) => p.id === back.tree.homePersonId)
    expect(home?.firstNames).toBe('Daniel')
  })

  test('keepIds keeps the ids', () => {
    const data = sampleFamily()
    const back = fromExportFile(toExportFile(data), { keepIds: true })
    expect(back.people.map((p) => p.id)).toEqual(data.people.map((p) => p.id))
    expect(back.tree.id).toBe(data.tree.id)
  })

  test('rejects a file that breaks the rules', () => {
    const data = sampleFamily()
    const file = toExportFile(data)
    const daniel = file.people.find((p) => p.firstNames === 'Daniel')?.id as string
    file.parentLinks.push({ id: 'bad', childId: daniel, parentId: daniel, kind: 'birth' })
    expect(() => fromExportFile(file)).toThrow()
    expect(() => fromExportFile({ format: 'other' })).toThrow()
  })
})

describe('GEDCOM', () => {
  test('a round trip keeps people, links and partnerships', () => {
    const data = sampleFamily()
    const text = toGedcom(data)
    expect(text).toStartWith('0 HEAD')
    expect(text).toContain('2 PEDI adopted')
    expect(text).toContain('1 DIV')
    const { data: back, warnings } = fromGedcom(text)
    expect(warnings).toEqual([])
    expect(shape(back)).toEqual(shape(data))
  })

  test('reads a GEDCOM file from another app', () => {
    const text = [
      '0 HEAD',
      '0 @N1@ NOTE A long',
      '1 CONC  story',
      '1 CONT second line',
      '0 @I1@ INDI',
      '1 NAME John Michael /Smith/',
      '1 SEX M',
      '1 BIRT',
      '2 DATE ABT 1850',
      '2 PLAC London, England',
      '1 DEAT Y',
      '1 NOTE @N1@',
      '0 @I2@ INDI',
      '1 NAME Mary /Smith/',
      '1 NAME Mary /Jones/',
      '2 TYPE maiden',
      '1 SEX F',
      '0 @I3@ INDI',
      '1 NAME Tom /Smith/',
      '1 FAMC @F1@',
      '2 PEDI adopted',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 MARR',
      '2 DATE 3 JUN 1875',
      '1 CHIL @I3@',
      '0 TRLR',
    ].join('\r\n')
    const { data, warnings } = fromGedcom(text)
    expect(warnings).toEqual([])
    const john = data.people.find((p) => p.firstNames === 'John Michael')
    expect(john).toMatchObject({
      surname: 'Smith',
      gender: 'male',
      bornDate: '~1850',
      bornPlace: 'London, England',
      died: true,
      story: 'A long story\nsecond line',
    })
    expect(data.people.find((p) => p.firstNames === 'Mary')?.birthSurname).toBe('Jones')
    expect(data.partnerships[0]).toMatchObject({ married: true, startDate: '1875-06-03' })
    expect(data.parentLinks.map((l) => l.kind)).toEqual(['adopted', 'adopted'])
    expect(data.tree.homePersonId).toBe(john?.id ?? null)
  })
})
