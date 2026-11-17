import { describe, expect, test } from 'bun:test'
import { hourglassLayout, type Layout } from '../src/layout.ts'
import { applyCommand, emptyTree } from '../src/ops.ts'
import { buildIndex } from '../src/relations.ts'
import { sampleFamily } from '../src/sample.ts'
import type { Command, TreeData } from '../src/types.ts'

const W = 184

function build(...commands: Command[]): TreeData {
  return commands.reduce((d, c) => applyCommand(d, c).data, emptyTree({ name: 'T' }))
}

const person = (id: string, bornDate = ''): Command => ({
  type: 'addPerson',
  person: { id, firstNames: id, bornDate },
})
const parent = (childId: string, parentId: string): Command => ({
  type: 'addParentLink',
  link: { childId, parentId },
})
const partner = (a: string, b: string, endDate = ''): Command => ({
  type: 'addPartnership',
  partnership: { personAId: a, personBId: b, endDate },
})

function expectNoOverlap(layout: Layout) {
  const rows = new Map<number, number[]>()
  for (const n of layout.nodes) rows.set(n.y, [...(rows.get(n.y) ?? []), n.x])
  for (const xs of rows.values()) {
    xs.sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) {
      expect((xs[i] as number) - (xs[i - 1] as number)).toBeGreaterThanOrEqual(W)
    }
  }
}

describe('hourglassLayout', () => {
  test('places ancestors above and descendants below the focus', () => {
    const data = build(
      person('me', '1990'),
      person('dad'),
      person('mum'),
      person('kid'),
      parent('me', 'dad'),
      parent('me', 'mum'),
      parent('kid', 'me'),
    )
    const layout = hourglassLayout(buildIndex(data), 'me')
    const y = (id: string) => layout.nodes.find((n) => n.personId === id)?.y as number
    expect(y('dad')).toBeLessThan(y('me'))
    expect(y('mum')).toBe(y('dad'))
    expect(y('kid')).toBeGreaterThan(y('me'))
    expect(layout.nodes.find((n) => n.personId === 'me')?.role).toBe('focus')
    expect(layout.edges.filter((e) => e.kind === 'partner')).toHaveLength(1)
    expectNoOverlap(layout)
  })

  test('groups children under the right partnership', () => {
    const data = build(
      person('ion'),
      person('maria'),
      person('elena'),
      person('ana', '1978'),
      person('mihai', '1984'),
      partner('ion', 'maria', '1980'),
      partner('ion', 'elena'),
      parent('ana', 'ion'),
      parent('ana', 'maria'),
      parent('mihai', 'ion'),
      parent('mihai', 'elena'),
    )
    const layout = hourglassLayout(buildIndex(data), 'ion')
    const x = (id: string) => layout.nodes.find((n) => n.personId === id)?.x as number
    expect(x('maria')).toBeLessThan(x('ion'))
    expect(x('elena')).toBeGreaterThan(x('ion'))
    expect(x('ana')).toBeLessThan(x('mihai'))
    const ended = layout.edges.filter((e) => e.kind === 'partner' && e.ended)
    expect(ended).toHaveLength(1)
    expectNoOverlap(layout)
  })

  test('shows siblings next to the focus, older on the left', () => {
    const data = build(
      person('me', '1990'),
      person('big', '1985'),
      person('small', '1995'),
      person('dad'),
      parent('me', 'dad'),
      parent('big', 'dad'),
      parent('small', 'dad'),
    )
    const layout = hourglassLayout(buildIndex(data), 'me')
    const node = (id: string) => layout.nodes.find((n) => n.personId === id)
    expect(node('big')?.role).toBe('sibling')
    expect(node('big')?.x as number).toBeLessThan(node('me')?.x as number)
    expect(node('small')?.x as number).toBeGreaterThan(node('me')?.x as number)
  })

  test('a partner shows no hidden children when all their children are shown', () => {
    const data = build(
      person('a'),
      person('b'),
      person('c'),
      person('d'),
      partner('a', 'b'),
      parent('c', 'a'),
      parent('c', 'b'),
      parent('d', 'b'),
    )
    const layout = hourglassLayout(buildIndex(data), 'a')
    const b = layout.nodes.find((n) => n.personId === 'b')
    expect(b?.moreDown).toBe(true)
    const withBoth = applyCommand(data, parent('d', 'a')).data
    const again = hourglassLayout(buildIndex(withBoth), 'a')
    expect(again.nodes.find((n) => n.personId === 'b')?.moreDown).toBe(false)
  })

  test('marks hidden relatives beyond the depth', () => {
    const data = build(person('a'), person('b'), person('c'), parent('b', 'a'), parent('c', 'b'))
    const layout = hourglassLayout(buildIndex(data), 'c', { ancestorDepth: 1 })
    const b = layout.nodes.find((n) => n.personId === 'b')
    expect(b?.moreUp).toBe(true)
    expect(layout.nodes.some((n) => n.personId === 'a')).toBe(false)
  })

  test('never overlaps cards in the sample family, from any focus', () => {
    const data = sampleFamily()
    const index = buildIndex(data)
    for (const p of data.people) {
      const layout = hourglassLayout(index, p.id)
      expect(layout.nodes.length).toBeGreaterThan(0)
      expectNoOverlap(layout)
    }
  })

  test('never overlaps cards in random trees', () => {
    let seed = 7
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed / 2 ** 31
    }
    for (let round = 0; round < 30; round++) {
      let data = emptyTree({ name: 'R' })
      const ids: string[] = []
      for (let i = 0; i < 40; i++) {
        const id = `p${i}`
        data = applyCommand(data, person(id, String(1900 + i * 2))).data
        if (ids.length) {
          const tries = Math.floor(rand() * 3)
          for (let t = 0; t < tries; t++) {
            const other = ids[Math.floor(rand() * ids.length)] as string
            const cmd = rand() < 0.6 ? parent(id, other) : partner(id, other)
            try {
              data = applyCommand(data, cmd).data
            } catch {}
          }
        }
        ids.push(id)
      }
      const index = buildIndex(data)
      for (const id of ids) expectNoOverlap(hourglassLayout(index, id))
    }
  })
})
