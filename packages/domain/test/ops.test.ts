import { describe, expect, test } from 'bun:test'
import { applyCommand, DomainError, emptyTree } from '../src/ops.ts'
import type { Command, TreeData } from '../src/types.ts'

const NOW = '2026-01-01T00:00:00.000Z'

function run(data: TreeData, ...commands: Command[]) {
  return commands.reduce((d, c) => applyCommand(d, c, { now: NOW }).data, data)
}

function base() {
  return run(
    emptyTree({ id: 't1', name: 'Popa', now: NOW }),
    { type: 'addPerson', person: { id: 'ion', firstNames: 'Ion', surname: 'Popa' } },
    { type: 'addPerson', person: { id: 'maria', firstNames: 'Maria' } },
    { type: 'addPerson', person: { id: 'ana', firstNames: 'Ana' } },
    { type: 'addPerson', person: { id: 'elena', firstNames: 'Elena' } },
  )
}

function expectCode(fn: () => unknown, code: string) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe(code)
    return
  }
  throw new Error(`expected ${code}`)
}

describe('people', () => {
  test('the first person becomes the Home person', () => {
    const data = base()
    expect(data.tree.homePersonId).toBe('ion')
    expect(data.people).toHaveLength(4)
  })

  test('fills defaults and trims text', () => {
    const { data, changes } = applyCommand(
      emptyTree({ id: 't', name: 'T', now: NOW }),
      { type: 'addPerson', person: { firstNames: '  Ion  ', bornDate: 'about 1931' } },
      { now: NOW },
    )
    const person = data.people[0]
    expect(person).toMatchObject({
      firstNames: 'Ion',
      surname: '',
      gender: 'unknown',
      died: false,
      bornDate: '~1931',
      createdAt: NOW,
    })
    expect(person?.id).toBeString()
    expect(changes.map((c) => c.entity)).toEqual(['person', 'tree'])
  })

  test('needs First names', () => {
    expectCode(
      () =>
        applyCommand(emptyTree({ id: 't', name: 'T' }), {
          type: 'addPerson',
          person: { firstNames: '   ' },
        }),
      'invalid',
    )
  })

  test('rejects a bad date', () => {
    expectCode(
      () =>
        applyCommand(base(), {
          type: 'updatePerson',
          id: 'ana',
          patch: { bornDate: '31/02/1990' },
        }),
      'invalid',
    )
  })

  test('a death date marks the person as dead', () => {
    const data = run(base(), { type: 'updatePerson', id: 'ion', patch: { diedDate: '2001' } })
    expect(data.people.find((p) => p.id === 'ion')?.died).toBe(true)
  })

  test('rejects an id that is already used', () => {
    expectCode(
      () => applyCommand(base(), { type: 'addPerson', person: { id: 'ion', firstNames: 'X' } }),
      'duplicate',
    )
  })

  test('respects the people limit', () => {
    expectCode(
      () =>
        applyCommand(base(), { type: 'addPerson', person: { firstNames: 'X' } }, { maxPeople: 4 }),
      'limit',
    )
  })

  test('deleting a person removes their links and moves the Home person', () => {
    const data = run(
      base(),
      { type: 'addParentLink', link: { id: 'l1', childId: 'ana', parentId: 'ion' } },
      { type: 'addPartnership', partnership: { id: 'p1', personAId: 'ion', personBId: 'maria' } },
    )
    const { data: after, changes } = applyCommand(data, { type: 'deletePerson', id: 'ion' })
    expect(after.people.map((p) => p.id)).not.toContain('ion')
    expect(after.parentLinks).toHaveLength(0)
    expect(after.partnerships).toHaveLength(0)
    expect(after.tree.homePersonId).toBe('maria')
    expect(changes).toContainEqual({ op: 'delete', entity: 'parentLink', id: 'l1' })
    expect(changes).toContainEqual({ op: 'delete', entity: 'partnership', id: 'p1' })
  })
})

describe('parent links', () => {
  test('a child can have at most 2 birth parents', () => {
    const data = run(
      base(),
      { type: 'addParentLink', link: { childId: 'ana', parentId: 'ion' } },
      { type: 'addParentLink', link: { childId: 'ana', parentId: 'maria' } },
    )
    expectCode(
      () =>
        applyCommand(data, {
          type: 'addParentLink',
          link: { childId: 'ana', parentId: 'elena' },
        }),
      'too_many_birth_parents',
    )
    const withStep = run(data, {
      type: 'addParentLink',
      link: { childId: 'ana', parentId: 'elena', kind: 'step' },
    })
    expect(withStep.parentLinks).toHaveLength(3)
  })

  test('a person cannot be their own parent or ancestor', () => {
    expectCode(
      () =>
        applyCommand(base(), { type: 'addParentLink', link: { childId: 'ana', parentId: 'ana' } }),
      'cycle',
    )
    const data = run(
      base(),
      { type: 'addParentLink', link: { childId: 'ana', parentId: 'ion' } },
      { type: 'addParentLink', link: { childId: 'elena', parentId: 'ana' } },
    )
    expectCode(
      () =>
        applyCommand(data, { type: 'addParentLink', link: { childId: 'ion', parentId: 'elena' } }),
      'cycle',
    )
  })

  test('rejects the same link twice and unknown persons', () => {
    const data = run(base(), { type: 'addParentLink', link: { childId: 'ana', parentId: 'ion' } })
    expectCode(
      () =>
        applyCommand(data, {
          type: 'addParentLink',
          link: { childId: 'ana', parentId: 'ion', kind: 'adopted' },
        }),
      'duplicate',
    )
    expectCode(
      () =>
        applyCommand(data, { type: 'addParentLink', link: { childId: 'ana', parentId: 'nobody' } }),
      'not_found',
    )
  })

  test('changing the kind to birth keeps the 2 birth parents rule', () => {
    const data = run(
      base(),
      { type: 'addParentLink', link: { childId: 'ana', parentId: 'ion' } },
      { type: 'addParentLink', link: { childId: 'ana', parentId: 'maria' } },
      { type: 'addParentLink', link: { id: 's', childId: 'ana', parentId: 'elena', kind: 'step' } },
    )
    expectCode(
      () => applyCommand(data, { type: 'updateParentLink', id: 's', kind: 'birth' }),
      'too_many_birth_parents',
    )
  })
})

describe('partnerships', () => {
  test('a person can have many partnerships', () => {
    const data = run(
      base(),
      {
        type: 'addPartnership',
        partnership: {
          personAId: 'ion',
          personBId: 'maria',
          married: true,
          startDate: '1975',
          endDate: '1980',
        },
      },
      {
        type: 'addPartnership',
        partnership: { personAId: 'ion', personBId: 'elena', married: true, startDate: '1982' },
      },
    )
    expect(data.partnerships).toHaveLength(2)
    expect(data.partnerships[0]?.ended).toBe(true)
    expect(data.partnerships[1]?.ended).toBe(false)
  })

  test('a person cannot partner with themselves', () => {
    expectCode(
      () =>
        applyCommand(base(), {
          type: 'addPartnership',
          partnership: { personAId: 'ion', personBId: 'ion' },
        }),
      'invalid',
    )
  })
})

describe('tree', () => {
  test('the Home person must be in the tree', () => {
    expectCode(
      () => applyCommand(base(), { type: 'updateTree', patch: { homePersonId: 'nobody' } }),
      'not_found',
    )
    const data = run(base(), { type: 'updateTree', patch: { homePersonId: 'ana', name: 'Mine' } })
    expect(data.tree).toMatchObject({ homePersonId: 'ana', name: 'Mine' })
  })

  test('commands do not change the input data', () => {
    const data = base()
    const snapshot = structuredClone(data)
    applyCommand(data, { type: 'deletePerson', id: 'ion' })
    expect(data).toEqual(snapshot)
  })
})
