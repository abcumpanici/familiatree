import { isCanonicalDate, parseDateInput } from './dates.ts'
import {
  type Change,
  type Command,
  GENDERS,
  type Id,
  PARENT_KINDS,
  type ParentLink,
  type Partnership,
  type PartnershipFields,
  type Person,
  type PersonFields,
  type Tree,
  type TreeData,
} from './types.ts'

export const LIMITS = {
  name: 200,
  place: 200,
  story: 20_000,
  photo: 400_000,
  treeName: 120,
} as const

export type DomainErrorCode =
  | 'invalid'
  | 'not_found'
  | 'duplicate'
  | 'cycle'
  | 'too_many_birth_parents'
  | 'limit'

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

export interface ApplyOptions {
  now?: string
  maxPeople?: number
  newId?: () => Id
}

export interface ApplyResult {
  data: TreeData
  changes: Change[]
}

export function newId(): Id {
  return crypto.randomUUID()
}

export function emptyTree(input: { id?: Id; name: string; now?: string }): TreeData {
  const now = input.now ?? new Date().toISOString()
  return {
    tree: {
      id: input.id ?? newId(),
      name: cleanText(input.name, LIMITS.treeName, 'name') || 'My family',
      homePersonId: null,
      createdAt: now,
      updatedAt: now,
    },
    people: [],
    parentLinks: [],
    partnerships: [],
  }
}

function cleanText(value: unknown, max: number, field: string): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new DomainError('invalid', `${field} must be text`)
  const text = value.trim()
  if (text.length > max)
    throw new DomainError('invalid', `${field} is longer than ${max} characters`)
  return text
}

function cleanDate(value: unknown, field: string): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') throw new DomainError('invalid', `${field} must be text`)
  if (isCanonicalDate(value)) return value
  const parsed = parseDateInput(value)
  if (parsed === null) throw new DomainError('invalid', `${field} "${value}" is not a date`)
  return parsed
}

function cleanPersonFields(input: Partial<PersonFields>, current?: PersonFields): PersonFields {
  const merged = { ...current, ...input }
  const firstNames = cleanText(merged.firstNames, LIMITS.name, 'firstNames')
  if (!firstNames) throw new DomainError('invalid', 'firstNames is required')
  const gender = merged.gender ?? 'unknown'
  if (!GENDERS.includes(gender)) throw new DomainError('invalid', `gender "${gender}" is unknown`)
  const photo = merged.photo ?? ''
  if (typeof photo !== 'string' || photo.length > LIMITS.photo) {
    throw new DomainError('invalid', 'photo is too large')
  }
  const diedDate = cleanDate(merged.diedDate, 'diedDate')
  const diedPlace = cleanText(merged.diedPlace, LIMITS.place, 'diedPlace')
  return {
    firstNames,
    surname: cleanText(merged.surname, LIMITS.name, 'surname'),
    birthSurname: cleanText(merged.birthSurname, LIMITS.name, 'birthSurname'),
    gender,
    bornDate: cleanDate(merged.bornDate, 'bornDate'),
    bornPlace: cleanText(merged.bornPlace, LIMITS.place, 'bornPlace'),
    died: Boolean(merged.died) || diedDate !== '' || diedPlace !== '',
    diedDate,
    diedPlace,
    photo,
    story: cleanText(merged.story, LIMITS.story, 'story'),
  }
}

function cleanPartnershipFields(
  input: Partial<PartnershipFields>,
  current?: PartnershipFields,
): PartnershipFields {
  const merged = { ...current, ...input }
  const endDate = cleanDate(merged.endDate, 'endDate')
  const endPlace = cleanText(merged.endPlace, LIMITS.place, 'endPlace')
  return {
    married: Boolean(merged.married),
    startDate: cleanDate(merged.startDate, 'startDate'),
    startPlace: cleanText(merged.startPlace, LIMITS.place, 'startPlace'),
    ended: Boolean(merged.ended) || endDate !== '' || endPlace !== '',
    endDate,
    endPlace,
  }
}

function requirePerson(data: TreeData, id: Id): Person {
  const person = data.people.find((p) => p.id === id)
  if (!person) throw new DomainError('not_found', `person ${id} is not in this tree`)
  return person
}

function requireUnusedId(data: TreeData, id: Id) {
  const used =
    data.people.some((p) => p.id === id) ||
    data.parentLinks.some((l) => l.id === id) ||
    data.partnerships.some((p) => p.id === id)
  if (used) throw new DomainError('duplicate', `id ${id} is already used`)
}

function checkId(id: unknown): Id | undefined {
  if (id === undefined) return undefined
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    throw new DomainError('invalid', 'id must be 1-64 letters, digits, "-" or "_"')
  }
  return id
}

function isAncestor(data: TreeData, ancestorId: Id, personId: Id): boolean {
  const seen = new Set<Id>()
  const stack = [personId]
  while (stack.length) {
    const current = stack.pop() as Id
    if (current === ancestorId) return true
    if (seen.has(current)) continue
    seen.add(current)
    for (const link of data.parentLinks) if (link.childId === current) stack.push(link.parentId)
  }
  return false
}

function checkParentLink(data: TreeData, link: ParentLink, ignoreId?: Id) {
  if (!PARENT_KINDS.includes(link.kind)) {
    throw new DomainError('invalid', `kind "${link.kind}" is unknown`)
  }
  requirePerson(data, link.childId)
  requirePerson(data, link.parentId)
  const others = data.parentLinks.filter((l) => l.id !== ignoreId)
  if (link.childId === link.parentId || isAncestor(data, link.childId, link.parentId)) {
    throw new DomainError('cycle', 'a person cannot be their own parent or ancestor')
  }
  if (others.some((l) => l.childId === link.childId && l.parentId === link.parentId)) {
    throw new DomainError('duplicate', 'this parent link already exists')
  }
  if (
    link.kind === 'birth' &&
    others.filter((l) => l.childId === link.childId && l.kind === 'birth').length >= 2
  ) {
    throw new DomainError('too_many_birth_parents', 'a child can have at most 2 birth parents')
  }
}

function touchTree(tree: Tree, now: string): Tree {
  return { ...tree, updatedAt: now }
}

export function applyCommand(
  data: TreeData,
  command: Command,
  options: ApplyOptions = {},
): ApplyResult {
  const now = options.now ?? new Date().toISOString()
  const makeId = options.newId ?? newId
  const changes: Change[] = []
  let next: TreeData = data
  let tree = data.tree

  switch (command.type) {
    case 'addPerson': {
      const id = checkId(command.person.id) ?? makeId()
      requireUnusedId(data, id)
      if (options.maxPeople !== undefined && data.people.length >= options.maxPeople) {
        throw new DomainError('limit', `a tree can hold at most ${options.maxPeople} persons`)
      }
      const person: Person = {
        id,
        ...cleanPersonFields(command.person),
        createdAt: now,
        updatedAt: now,
      }
      if (tree.homePersonId === null) tree = { ...tree, homePersonId: id }
      next = { ...data, people: [...data.people, person] }
      changes.push({ op: 'put', entity: 'person', value: person })
      break
    }
    case 'updatePerson': {
      const current = requirePerson(data, command.id)
      const person: Person = {
        ...current,
        ...cleanPersonFields(command.patch, current),
        updatedAt: now,
      }
      next = { ...data, people: data.people.map((p) => (p.id === person.id ? person : p)) }
      changes.push({ op: 'put', entity: 'person', value: person })
      break
    }
    case 'deletePerson': {
      requirePerson(data, command.id)
      const links = data.parentLinks.filter(
        (l) => l.childId === command.id || l.parentId === command.id,
      )
      const partnerships = data.partnerships.filter(
        (p) => p.personAId === command.id || p.personBId === command.id,
      )
      const people = data.people.filter((p) => p.id !== command.id)
      if (tree.homePersonId === command.id) tree = { ...tree, homePersonId: people[0]?.id ?? null }
      next = {
        ...data,
        people,
        parentLinks: data.parentLinks.filter((l) => !links.includes(l)),
        partnerships: data.partnerships.filter((p) => !partnerships.includes(p)),
      }
      for (const l of links) changes.push({ op: 'delete', entity: 'parentLink', id: l.id })
      for (const p of partnerships) changes.push({ op: 'delete', entity: 'partnership', id: p.id })
      changes.push({ op: 'delete', entity: 'person', id: command.id })
      break
    }
    case 'addParentLink': {
      const id = checkId(command.link.id) ?? makeId()
      requireUnusedId(data, id)
      const link: ParentLink = {
        id,
        childId: command.link.childId,
        parentId: command.link.parentId,
        kind: command.link.kind ?? 'birth',
      }
      checkParentLink(data, link)
      next = { ...data, parentLinks: [...data.parentLinks, link] }
      changes.push({ op: 'put', entity: 'parentLink', value: link })
      break
    }
    case 'updateParentLink': {
      const current = data.parentLinks.find((l) => l.id === command.id)
      if (!current) throw new DomainError('not_found', `parent link ${command.id} does not exist`)
      const link: ParentLink = { ...current, kind: command.kind }
      checkParentLink(data, link, link.id)
      next = { ...data, parentLinks: data.parentLinks.map((l) => (l.id === link.id ? link : l)) }
      changes.push({ op: 'put', entity: 'parentLink', value: link })
      break
    }
    case 'removeParentLink': {
      if (!data.parentLinks.some((l) => l.id === command.id)) {
        throw new DomainError('not_found', `parent link ${command.id} does not exist`)
      }
      next = { ...data, parentLinks: data.parentLinks.filter((l) => l.id !== command.id) }
      changes.push({ op: 'delete', entity: 'parentLink', id: command.id })
      break
    }
    case 'addPartnership': {
      const id = checkId(command.partnership.id) ?? makeId()
      requireUnusedId(data, id)
      const { personAId, personBId } = command.partnership
      requirePerson(data, personAId)
      requirePerson(data, personBId)
      if (personAId === personBId) {
        throw new DomainError('invalid', 'a person cannot be their own partner')
      }
      const partnership: Partnership = {
        id,
        personAId,
        personBId,
        ...cleanPartnershipFields(command.partnership),
      }
      next = { ...data, partnerships: [...data.partnerships, partnership] }
      changes.push({ op: 'put', entity: 'partnership', value: partnership })
      break
    }
    case 'updatePartnership': {
      const current = data.partnerships.find((p) => p.id === command.id)
      if (!current) throw new DomainError('not_found', `partnership ${command.id} does not exist`)
      const partnership: Partnership = {
        ...current,
        ...cleanPartnershipFields(command.patch, current),
      }
      next = {
        ...data,
        partnerships: data.partnerships.map((p) => (p.id === partnership.id ? partnership : p)),
      }
      changes.push({ op: 'put', entity: 'partnership', value: partnership })
      break
    }
    case 'removePartnership': {
      if (!data.partnerships.some((p) => p.id === command.id)) {
        throw new DomainError('not_found', `partnership ${command.id} does not exist`)
      }
      next = { ...data, partnerships: data.partnerships.filter((p) => p.id !== command.id) }
      changes.push({ op: 'delete', entity: 'partnership', id: command.id })
      break
    }
    case 'updateTree': {
      const { name, homePersonId } = command.patch
      if (name !== undefined) {
        tree = { ...tree, name: cleanText(name, LIMITS.treeName, 'name') || tree.name }
      }
      if (homePersonId !== undefined) {
        if (homePersonId !== null) requirePerson(data, homePersonId)
        tree = { ...tree, homePersonId }
      }
      break
    }
    default: {
      const unknown: never = command
      throw new DomainError('invalid', `unknown command ${(unknown as { type: string }).type}`)
    }
  }

  tree = touchTree(tree, now)
  changes.push({ op: 'put', entity: 'tree', value: tree })
  return { data: { ...next, tree }, changes }
}
