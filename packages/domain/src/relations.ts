import { compareDates } from './dates.ts'
import type { Id, ParentKind, ParentLink, Partnership, Person, TreeData } from './types.ts'

export interface TreeIndex {
  data: TreeData
  people: Map<Id, Person>
  parentsOf: Map<Id, ParentLink[]>
  childrenOf: Map<Id, ParentLink[]>
  partnershipsOf: Map<Id, Partnership[]>
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function buildIndex(data: TreeData): TreeIndex {
  const people = new Map(data.people.map((p) => [p.id, p]))
  const parentsOf = new Map<Id, ParentLink[]>()
  const childrenOf = new Map<Id, ParentLink[]>()
  const partnershipsOf = new Map<Id, Partnership[]>()
  for (const link of data.parentLinks) {
    push(parentsOf, link.childId, link)
    push(childrenOf, link.parentId, link)
  }
  const sorted = [...data.partnerships].sort((a, b) => compareDates(a.startDate, b.startDate))
  for (const p of sorted) {
    push(partnershipsOf, p.personAId, p)
    push(partnershipsOf, p.personBId, p)
  }
  return { data, people, parentsOf, childrenOf, partnershipsOf }
}

const KIND_ORDER: Record<ParentKind, number> = { birth: 0, adopted: 1, foster: 2, step: 3 }

export function byBirth(index: TreeIndex) {
  return (a: Id, b: Id) =>
    compareDates(index.people.get(a)?.bornDate ?? '', index.people.get(b)?.bornDate ?? '')
}

export function otherPerson(p: Partnership, id: Id): Id {
  return p.personAId === id ? p.personBId : p.personAId
}

export interface PartnerEntry {
  partnerId: Id
  partnership: Partnership | null
}

export function partnersOf(index: TreeIndex, id: Id): PartnerEntry[] {
  const out: PartnerEntry[] = []
  const seen = new Set<Id>()
  for (const p of index.partnershipsOf.get(id) ?? []) {
    const partnerId = otherPerson(p, id)
    if (seen.has(partnerId) || !index.people.has(partnerId)) continue
    seen.add(partnerId)
    out.push({ partnerId, partnership: p })
  }
  for (const group of childGroups(index, id)) {
    if (group.coParentId && !seen.has(group.coParentId)) {
      seen.add(group.coParentId)
      out.push({ partnerId: group.coParentId, partnership: null })
    }
  }
  return out
}

export function parentLinksOf(index: TreeIndex, id: Id): ParentLink[] {
  return [...(index.parentsOf.get(id) ?? [])].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  )
}

export function pedigreeParents(index: TreeIndex, id: Id): ParentLink[] {
  const links = parentLinksOf(index, id)
  const first = links[0]
  if (!first) return []
  const sameKind = links.filter((l) => l.kind === first.kind)
  return sameKind.slice(0, 2)
}

export interface ChildGroup {
  coParentId: Id | null
  children: ParentLink[]
}

export function coParentOf(index: TreeIndex, link: ParentLink): Id | null {
  const others = (index.parentsOf.get(link.childId) ?? []).filter(
    (l) => l.parentId !== link.parentId,
  )
  const same = others.find((l) => l.kind === link.kind)
  return (same ?? others[0])?.parentId ?? null
}

export function childGroups(index: TreeIndex, id: Id): ChildGroup[] {
  const groups = new Map<Id | null, ParentLink[]>()
  const order = byBirth(index)
  for (const link of index.childrenOf.get(id) ?? []) {
    push(groups, coParentOf(index, link), link)
  }
  return [...groups.entries()].map(([coParentId, children]) => ({
    coParentId,
    children: children.sort((a, b) => order(a.childId, b.childId)),
  }))
}

export interface SiblingEntry {
  id: Id
  sharedParentIds: Id[]
}

export function siblingsOf(index: TreeIndex, id: Id): SiblingEntry[] {
  const parents = (index.parentsOf.get(id) ?? []).map((l) => l.parentId)
  const shared = new Map<Id, Set<Id>>()
  for (const parentId of parents) {
    for (const link of index.childrenOf.get(parentId) ?? []) {
      if (link.childId === id) continue
      const set = shared.get(link.childId) ?? new Set()
      set.add(parentId)
      shared.set(link.childId, set)
    }
  }
  const order = byBirth(index)
  return [...shared.entries()]
    .map(([sid, set]) => ({ id: sid, sharedParentIds: [...set] }))
    .sort((a, b) => order(a.id, b.id))
}

export function displayName(person: Pick<Person, 'firstNames' | 'surname'>): string {
  return [person.firstNames, person.surname].filter(Boolean).join(' ')
}
