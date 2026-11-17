import { compareDates } from './dates.ts'
import {
  childGroups,
  type PartnerEntry,
  partnersOf,
  pedigreeParents,
  siblingsOf,
  type TreeIndex,
} from './relations.ts'
import type { Id, ParentKind, Partnership } from './types.ts'

export type NodeRole = 'focus' | 'ancestor' | 'descendant' | 'partner' | 'sibling'

export interface LayoutNode {
  key: string
  personId: Id
  x: number
  y: number
  role: NodeRole
  generation: number
  moreUp: boolean
  moreDown: boolean
}

export type EdgeKind = 'child' | 'partner'

export interface LayoutEdge {
  key: string
  kind: EdgeKind
  path: string
  parentKind?: ParentKind
  partnership?: Partnership | null
  ended?: boolean
}

export interface Layout {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

export interface LayoutOptions {
  ancestorDepth?: number
  descendantDepth?: number
  cardWidth?: number
  cardHeight?: number
  gap?: number
  partnerGap?: number
  rowGap?: number
}

export function hourglassLayout(
  index: TreeIndex,
  focusId: Id,
  options: LayoutOptions = {},
): Layout {
  const ancestorDepth = options.ancestorDepth ?? 3
  const descendantDepth = options.descendantDepth ?? 3
  const W = options.cardWidth ?? 184
  const H = options.cardHeight ?? 72
  const GAP = options.gap ?? 28
  const PGAP = options.partnerGap ?? 36
  const ROW = H + (options.rowGap ?? 84)

  const nodes: LayoutNode[] = []
  const edges: LayoutEdge[] = []
  const keyCount = new Map<Id, number>()

  if (!index.people.has(focusId)) {
    return { nodes, edges, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } }
  }

  const rowY = (generation: number) => generation * ROW
  const mid = (generation: number) => rowY(generation) + H / 2
  const busY = (generation: number) => rowY(generation) + H + (ROW - H) / 2

  function addNode(personId: Id, x: number, generation: number, role: NodeRole, shown: Shown) {
    const n = keyCount.get(personId) ?? 0
    keyCount.set(personId, n + 1)
    const key = n === 0 ? personId : `${personId}~${n}`
    const hasParents = (index.parentsOf.get(personId)?.length ?? 0) > 0
    const hasChildren = (index.childrenOf.get(personId)?.length ?? 0) > 0
    const node: LayoutNode = {
      key,
      personId,
      x,
      y: rowY(generation),
      role,
      generation,
      moreUp: hasParents && !shown.up,
      moreDown: hasChildren && !shown.down,
    }
    nodes.push(node)
    return node
  }

  function childEdge(
    from: { x: number; y: number },
    child: LayoutNode,
    parentGen: number,
    kind: ParentKind,
  ) {
    const by = busY(parentGen)
    edges.push({
      key: `c:${from.x.toFixed(0)}:${from.y.toFixed(0)}>${child.key}`,
      kind: 'child',
      parentKind: kind,
      path: elbow(from.x, from.y, child.x, by, child.y),
    })
  }

  function partnerEdge(a: LayoutNode, b: LayoutNode, partnership: Partnership | null) {
    const [left, right] = a.x <= b.x ? [a, b] : [b, a]
    const y = left.y + H / 2
    edges.push({
      key: `p:${left.key}=${right.key}`,
      kind: 'partner',
      partnership,
      ended: partnership?.ended ?? false,
      path: `M ${left.x + W / 2} ${y} H ${right.x - W / 2}`,
    })
  }

  type Shown = { up: boolean; down: boolean }

  const unitCache = new Map<Id, PartnerEntry[]>()
  function unitPartners(id: Id) {
    let list = unitCache.get(id)
    if (!list) {
      list = partnersOf(index, id)
      unitCache.set(id, list)
    }
    return list
  }

  function unitOrder(id: Id): Id[] {
    const entries = unitPartners(id)
    if (entries.length === 0) return [id]
    const ended = (e: PartnerEntry) => (e.partnership?.ended ? 0 : 1)
    const partners = [...entries]
      .sort(
        (a, b) =>
          ended(a) - ended(b) ||
          compareDates(a.partnership?.startDate ?? '', b.partnership?.startDate ?? ''),
      )
      .map((p) => p.partnerId)
    if (partners.length === 1) return [id, partners[0] as Id]
    const [left, ...right] = partners
    return [left as Id, id, ...right]
  }

  function unitWidth(id: Id) {
    const count = unitOrder(id).length
    return count * W + (count - 1) * PGAP
  }

  function orderedChildren(id: Id) {
    const order = unitOrder(id)
    const pos = (coParent: Id | null) => order.indexOf(coParent ?? id)
    return childGroups(index, id)
      .sort((a, b) => pos(a.coParentId) - pos(b.coParentId))
      .flatMap((g) => g.children.map((link) => ({ link, coParentId: g.coParentId })))
  }

  const descCache = new Map<string, number>()
  function descWidth(id: Id, depth: number, trail: Set<Id>): number {
    const cacheKey = `${id}:${depth}`
    const cached = descCache.get(cacheKey)
    if (cached !== undefined) return cached
    let width = unitWidth(id)
    if (depth > 0 && !trail.has(id)) {
      trail.add(id)
      const kids = orderedChildren(id)
      if (kids.length) {
        const total =
          kids.reduce((s, k) => s + descWidth(k.link.childId, depth - 1, trail), 0) +
          GAP * (kids.length - 1)
        width = Math.max(width, total)
      }
      trail.delete(id)
    }
    descCache.set(cacheKey, width)
    return width
  }

  function placeDescendants(
    id: Id,
    cx: number,
    generation: number,
    depth: number,
    role: NodeRole,
    trail: Set<Id>,
  ): LayoutNode {
    const order = unitOrder(id)
    const uw = unitWidth(id)
    const showChildren = depth > 0 && !trail.has(id)
    const kids = showChildren ? orderedChildren(id) : []
    const members = new Map<Id, LayoutNode>()
    let x = cx - uw / 2 + W / 2
    for (const memberId of order) {
      const isSelf = memberId === id
      members.set(
        memberId,
        addNode(memberId, x, generation, isSelf ? role : 'partner', {
          up: isSelf && role === 'ancestor',
          down: isSelf
            ? showChildren
            : showChildren &&
              (index.childrenOf.get(memberId) ?? []).every((l) =>
                (index.parentsOf.get(l.childId) ?? []).some((pl) => pl.parentId === id),
              ),
        }),
      )
      x += W + PGAP
    }
    const self = members.get(id) as LayoutNode
    for (const entry of unitPartners(id)) {
      const partner = members.get(entry.partnerId)
      if (partner) partnerEdge(self, partner, entry.partnership)
    }
    if (kids.length) {
      trail.add(id)
      const widths = kids.map((k) => descWidth(k.link.childId, depth - 1, trail))
      const total = widths.reduce((s, w) => s + w, 0) + GAP * (kids.length - 1)
      let start = cx - total / 2
      kids.forEach((k, i) => {
        const w = widths[i] as number
        const child = placeDescendants(
          k.link.childId,
          start + w / 2,
          generation + 1,
          depth - 1,
          'descendant',
          trail,
        )
        const co = k.coParentId ? members.get(k.coParentId) : undefined
        const from = co
          ? { x: (self.x + co.x) / 2, y: mid(generation) }
          : { x: self.x, y: rowY(generation) + H }
        childEdge(from, child, generation, k.link.kind)
        start += w + GAP
      })
      trail.delete(id)
    }
    return self
  }

  const ancCache = new Map<string, number>()
  function ancWidth(id: Id, depth: number): number {
    const cacheKey = `${id}:${depth}`
    const cached = ancCache.get(cacheKey)
    if (cached !== undefined) return cached
    const parents = depth > 0 ? pedigreeParents(index, id) : []
    const width = parents.length
      ? Math.max(
          W,
          parents.reduce((s, l) => s + ancWidth(l.parentId, depth - 1), 0) +
            GAP * (parents.length - 1),
        )
      : W
    ancCache.set(cacheKey, width)
    return width
  }

  function placeAncestors(
    childId: Id,
    cx: number,
    childGeneration: number,
    depth: number,
  ): Map<Id, LayoutNode> {
    const placed = new Map<Id, LayoutNode>()
    if (depth <= 0) return placed
    const parents = pedigreeParents(index, childId)
    if (!parents.length) return placed
    const generation = childGeneration - 1
    const widths = parents.map((l) => ancWidth(l.parentId, depth - 1))
    const total = widths.reduce((s, w) => s + w, 0) + GAP * (parents.length - 1)
    let start = cx - total / 2
    parents.forEach((link, i) => {
      const w = widths[i] as number
      const px = start + w / 2
      const node = addNode(link.parentId, px, generation, 'ancestor', {
        up: depth - 1 > 0,
        down: true,
      })
      placed.set(link.parentId, node)
      const grand = placeAncestors(link.parentId, px, generation, depth - 1)
      connectParents(grand, node, generation - 1, link.parentId)
      start += w + GAP
    })
    const [a, b] = [...placed.values()]
    if (a && b) partnerEdge(a, b, findPartnership(a.personId, b.personId))
    return placed
  }

  function findPartnership(a: Id, b: Id): Partnership | null {
    return (
      (index.partnershipsOf.get(a) ?? []).find((p) => p.personAId === b || p.personBId === b) ??
      null
    )
  }

  function parentOrigin(parents: LayoutNode[], generation: number) {
    const [a, b] = parents
    if (a && b) return { x: (a.x + b.x) / 2, y: mid(generation) }
    if (a) return { x: a.x, y: rowY(generation) + H }
    return null
  }

  function connectParents(
    parents: Map<Id, LayoutNode>,
    child: LayoutNode,
    parentGeneration: number,
    childId: Id,
  ) {
    const origin = parentOrigin([...parents.values()], parentGeneration)
    if (!origin) return
    const kind = pedigreeParents(index, childId)[0]?.kind ?? 'birth'
    childEdge(origin, child, parentGeneration, kind)
  }

  const descendantsTrail = new Set<Id>()
  const blockWidth = descWidth(focusId, descendantDepth, new Set())
  const focusNode = placeDescendants(focusId, 0, 0, descendantDepth, 'focus', descendantsTrail)

  const focusBorn = index.people.get(focusId)?.bornDate ?? ''
  const parentNodes = placeAncestors(focusId, focusNode.x, 0, ancestorDepth)
  connectParents(parentNodes, focusNode, -1, focusId)
  focusNode.moreUp = (index.parentsOf.get(focusId)?.length ?? 0) > 0 && parentNodes.size === 0

  const siblings = siblingsOf(index, focusId).filter((s) => !keyCount.has(s.id))
  const older = siblings.filter(
    (s) => compareDates(index.people.get(s.id)?.bornDate ?? '', focusBorn) < 0 && focusBorn !== '',
  )
  const younger = siblings.filter((s) => !older.includes(s))
  const leftEdge = Math.min(-blockWidth / 2, focusNode.x - W / 2)
  const rightEdge = Math.max(blockWidth / 2, focusNode.x + W / 2)
  const placeSibling = (s: (typeof siblings)[number], x: number) => {
    const node = addNode(s.id, x, 0, 'sibling', { up: false, down: false })
    node.moreUp = false
    const shown = s.sharedParentIds
      .map((id) => parentNodes.get(id))
      .filter((n): n is LayoutNode => n !== undefined)
    const origin =
      shown.length === parentNodes.size
        ? parentOrigin(shown, -1)
        : parentOrigin(shown.slice(0, 1), -1)
    if (origin) {
      const kind =
        (index.parentsOf.get(s.id) ?? []).find((l) => s.sharedParentIds.includes(l.parentId))
          ?.kind ?? 'birth'
      childEdge(origin, node, -1, kind)
    }
  }
  older.reverse().forEach((s, i) => {
    placeSibling(s, leftEdge - GAP - W / 2 - i * (W + GAP))
  })
  younger.forEach((s, i) => {
    placeSibling(s, rightEdge + GAP + W / 2 + i * (W + GAP))
  })

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const n of nodes) {
    minX = Math.min(minX, n.x - W / 2)
    maxX = Math.max(maxX, n.x + W / 2)
    minY = Math.min(minY, n.y)
    maxY = Math.max(maxY, n.y + H)
  }
  return { nodes, edges, bounds: { minX, minY, maxX, maxY } }
}

function elbow(x1: number, y1: number, x2: number, busY: number, y2: number): string {
  const r = Math.min(10, Math.abs(x2 - x1) / 2, Math.abs(busY - y1), Math.abs(y2 - busY))
  if (Math.abs(x2 - x1) < 0.5) return `M ${x1} ${y1} V ${y2}`
  const dir = x2 > x1 ? 1 : -1
  return [
    `M ${x1} ${y1}`,
    `V ${busY - r}`,
    `Q ${x1} ${busY} ${x1 + dir * r} ${busY}`,
    `H ${x2 - dir * r}`,
    `Q ${x2} ${busY} ${x2} ${busY + r}`,
    `V ${y2}`,
  ].join(' ')
}
