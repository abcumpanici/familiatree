import { partnersOf, siblingsOf, type TreeIndex } from './relations.ts'
import type { Gender, Id, ParentKind } from './types.ts'

type Words = [male: string, female: string, neutral: string]

const W = {
  parent: ['Father', 'Mother', 'Parent'],
  child: ['Son', 'Daughter', 'Child'],
  sibling: ['Brother', 'Sister', 'Sibling'],
  spouse: ['Husband', 'Wife', 'Spouse'],
  exSpouse: ['Ex-husband', 'Ex-wife', 'Former spouse'],
  partner: ['Partner', 'Partner', 'Partner'],
  exPartner: ['Former partner', 'Former partner', 'Former partner'],
  uncle: ['Uncle', 'Aunt', 'Uncle or aunt'],
  nephew: ['Nephew', 'Niece', 'Nephew or niece'],
  siblingInLaw: ['Brother-in-law', 'Sister-in-law', 'Sibling-in-law'],
} satisfies Record<string, Words>

function pick(words: Words, gender: Gender | undefined) {
  return gender === 'male' ? words[0] : gender === 'female' ? words[1] : words[2]
}

function lower(word: string) {
  return word.charAt(0).toLowerCase() + word.slice(1)
}

function greats(gen: number) {
  if (gen <= 0) return ''
  if (gen === 1) return 'Great-'
  return `${gen}× great-`
}

const ORDINAL = ['', '', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth']
const TIMES = ['', 'once', 'twice', 'three times', 'four times']

interface Reach {
  gen: number
  kind: ParentKind
}

function walk(index: TreeIndex, start: Id, up: boolean): Map<Id, Reach> {
  const out = new Map<Id, Reach>()
  let frontier: { id: Id; kind: ParentKind | null }[] = [{ id: start, kind: null }]
  for (let gen = 1; frontier.length && gen < 12; gen++) {
    const next: typeof frontier = []
    for (const { id, kind } of frontier) {
      const links = (up ? index.parentsOf : index.childrenOf).get(id) ?? []
      for (const link of links) {
        const other = up ? link.parentId : link.childId
        if (other === start || out.has(other)) continue
        const reach = { gen, kind: kind ?? link.kind }
        out.set(other, reach)
        next.push({ id: other, kind: reach.kind })
      }
    }
    frontier = next
  }
  return out
}

function lineal(words: Words, reach: Reach, gender: Gender | undefined, up: boolean): string {
  const base = pick(words, gender)
  if (reach.gen === 1) {
    if (reach.kind === 'birth') return base
    if (reach.kind === 'step') return `Step${lower(base)}`
    if (reach.kind === 'foster') return `Foster ${lower(base)}`
    return up ? `Adoptive ${lower(base)}` : `Adopted ${lower(base)}`
  }
  const grand = `Grand${lower(base)}`
  return reach.gen === 2 ? grand : `${greats(reach.gen - 2)}${lower(grand)}`
}

export function relationLabel(index: TreeIndex, fromId: Id, toId: Id): string | null {
  if (fromId === toId) return null
  const to = index.people.get(toId)
  if (!to || !index.people.has(fromId)) return null
  const g = to.gender

  const up = walk(index, fromId, true)
  const ancestor = up.get(toId)
  if (ancestor) return lineal(W.parent, ancestor, g, true)

  const down = walk(index, fromId, false)
  const descendant = down.get(toId)
  if (descendant) return lineal(W.child, descendant, g, false)

  const partners = partnersOf(index, fromId)
  const partner = partners.find((p) => p.partnerId === toId)
  if (partner) {
    const p = partner.partnership
    if (p?.married) return pick(p.ended ? W.exSpouse : W.spouse, g)
    return pick(p?.ended ? W.exPartner : W.partner, g)
  }

  const siblings = siblingsOf(index, fromId)
  const ownParents = new Set((index.parentsOf.get(fromId) ?? []).map((l) => l.parentId))
  const sibling = siblings.find((s) => s.id === toId)
  if (sibling) {
    const word = pick(W.sibling, g)
    return sibling.sharedParentIds.length < Math.min(2, ownParents.size)
      ? `Half-${lower(word)}`
      : word
  }

  for (const [ancestorId, reach] of up) {
    if (reach.gen !== 1) continue
    const ofParent = partnersOf(index, ancestorId).find((p) => p.partnerId === toId)
    if (ofParent && !(ofParent.partnership?.ended ?? false)) {
      return `Step${lower(pick(W.parent, g))}`
    }
  }
  for (const p of partners) {
    if (p.partnership?.ended) continue
    if (index.parentsOf.get(toId)?.some((l) => l.parentId === p.partnerId)) {
      return `Step${lower(pick(W.child, g))}`
    }
  }

  for (const [descId, reach] of down) {
    if (partnersOf(index, descId).some((p) => p.partnerId === toId && !p.partnership?.ended)) {
      const word = pick(W.child, g)
      const base = reach.gen === 1 ? word : `${greats(reach.gen - 2)}grand${lower(word)}`
      return `${base.charAt(0).toUpperCase()}${base.slice(1)}-in-law`
    }
  }

  for (const p of partners) {
    if (p.partnership?.ended) continue
    const parentOfPartner = (index.parentsOf.get(p.partnerId) ?? []).find(
      (l) => l.parentId === toId,
    )
    if (parentOfPartner) return `${pick(W.parent, g)}-in-law`
    const ancestorOfPartner = walk(index, p.partnerId, true).get(toId)
    if (ancestorOfPartner) return `${lineal(W.parent, ancestorOfPartner, g, true)}-in-law`
    if (siblingsOf(index, p.partnerId).some((s) => s.id === toId)) return pick(W.siblingInLaw, g)
  }
  for (const p of partners) {
    if (p.partnership?.ended) continue
    for (const s of siblingsOf(index, p.partnerId)) {
      if (partnersOf(index, s.id).some((q) => q.partnerId === toId && !q.partnership?.ended)) {
        return pick(W.siblingInLaw, g)
      }
      const d = walk(index, s.id, false).get(toId)?.gen
      if (d) return `${greats(d - 1)}${d > 1 ? lower(pick(W.nephew, g)) : pick(W.nephew, g)}`
    }
  }
  for (const s of siblings) {
    if (partnersOf(index, s.id).some((p) => p.partnerId === toId && !p.partnership?.ended)) {
      return pick(W.siblingInLaw, g)
    }
  }

  const ancestorGen = new Map<Id, number>([
    [fromId, 0],
    ...[...up].map(([id, r]) => [id, r.gen] as const),
  ])
  let best: { a: number; d: number } | null = null
  for (const [ancestorId, a] of ancestorGen) {
    for (const s of siblingsOf(index, ancestorId)) {
      if (ancestorGen.has(s.id)) continue
      const d = s.id === toId ? 0 : (walk(index, s.id, false).get(toId)?.gen ?? -1)
      if (d < 0) continue
      if (!best || a + d < best.a + best.d) best = { a, d }
    }
  }
  if (best) {
    const { a, d } = best
    if (d === 0) return `${greats(a - 1)}${a > 1 ? lower(pick(W.uncle, g)) : pick(W.uncle, g)}`
    if (a === 0) return `${greats(d - 1)}${d > 1 ? lower(pick(W.nephew, g)) : pick(W.nephew, g)}`
    const degree = Math.min(a, d)
    const removed = Math.abs(a - d)
    const name = degree === 1 ? 'Cousin' : `${ORDINAL[degree] ?? `${degree}th`} cousin`
    return removed ? `${name} ${TIMES[removed] ?? `${removed} times`} removed` : name
  }
  return null
}
