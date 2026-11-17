import { fromGedcomDate, toGedcomDate } from './dates.ts'
import { applyCommand, DomainError, emptyTree, newId } from './ops.ts'
import type { Command, Gender, Id, ParentKind, Partnership, TreeData } from './types.ts'

interface FamilyUnit {
  parents: Id[]
  partnership: Partnership | null
  children: { id: Id; kind: ParentKind }[]
}

function familyUnits(data: TreeData): FamilyUnit[] {
  const units: FamilyUnit[] = []
  const byPair = new Map<string, FamilyUnit>()
  const pairKey = (ids: Id[]) => [...ids].sort().join('|')
  for (const p of data.partnerships) {
    const unit: FamilyUnit = { parents: [p.personAId, p.personBId], partnership: p, children: [] }
    units.push(unit)
    const key = pairKey(unit.parents)
    if (!byPair.has(key)) byPair.set(key, unit)
  }
  const linksByChild = new Map<Id, Map<ParentKind, Id[]>>()
  for (const l of data.parentLinks) {
    const kinds = linksByChild.get(l.childId) ?? new Map<ParentKind, Id[]>()
    kinds.set(l.kind, [...(kinds.get(l.kind) ?? []), l.parentId])
    linksByChild.set(l.childId, kinds)
  }
  for (const [childId, kinds] of linksByChild) {
    for (const [kind, parents] of kinds) {
      for (let i = 0; i < parents.length; i += 2) {
        const pair = parents.slice(i, i + 2)
        const key = pairKey(pair)
        let unit = byPair.get(key)
        if (!unit) {
          unit = { parents: pair, partnership: null, children: [] }
          units.push(unit)
          byPair.set(key, unit)
        }
        unit.children.push({ id: childId, kind })
      }
    }
  }
  return units
}

function text(level: number, tag: string, value: string): string[] {
  const lines = value.split(/\r?\n/)
  const out: string[] = []
  lines.forEach((line, i) => {
    const chunks = line.match(/.{1,200}/gsu) ?? ['']
    chunks.forEach((chunk, j) => {
      if (i === 0 && j === 0) out.push(`${level} ${tag}${chunk ? ` ${chunk}` : ''}`)
      else out.push(`${level + 1} ${j === 0 ? 'CONT' : 'CONC'}${chunk ? ` ${chunk}` : ''}`)
    })
  })
  return out
}

function event(level: number, tag: string, date: string, place: string, always = false) {
  if (!date && !place) return always ? [`${level} ${tag} Y`] : []
  const out = [`${level} ${tag}`]
  if (date) out.push(`${level + 1} DATE ${toGedcomDate(date)}`)
  if (place) out.push(`${level + 1} PLAC ${place}`)
  return out
}

const SEX: Record<Gender, string> = { male: 'M', female: 'F', other: 'X', unknown: 'U' }
const PEDI: Record<ParentKind, string> = {
  birth: 'birth',
  adopted: 'adopted',
  foster: 'foster',
  step: 'step',
}

export function toGedcom(data: TreeData, now = new Date()): string {
  const indi = new Map(data.people.map((p, i) => [p.id, `@I${i + 1}@`]))
  const units = familyUnits(data)
  const famc = new Map<Id, { fam: string; kind: ParentKind }[]>()
  const fams = new Map<Id, string[]>()
  units.forEach((u, i) => {
    const ref = `@F${i + 1}@`
    for (const c of u.children)
      famc.set(c.id, [...(famc.get(c.id) ?? []), { fam: ref, kind: c.kind }])
    for (const p of u.parents) fams.set(p, [...(fams.get(p) ?? []), ref])
  })
  const date = now.toISOString().slice(0, 10)
  const lines = [
    '0 HEAD',
    '1 SOUR FAMILYTREE',
    '2 NAME Family Tree',
    `1 DATE ${toGedcomDate(date)}`,
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
  ]
  for (const p of data.people) {
    lines.push(`0 ${indi.get(p.id)} INDI`)
    lines.push(`1 NAME ${p.firstNames} /${p.surname}/`, `2 GIVN ${p.firstNames}`)
    if (p.surname) lines.push(`2 SURN ${p.surname}`)
    if (p.birthSurname && p.birthSurname !== p.surname) {
      lines.push(
        `1 NAME ${p.firstNames} /${p.birthSurname}/`,
        '2 TYPE birth',
        `2 SURN ${p.birthSurname}`,
      )
    }
    lines.push(`1 SEX ${SEX[p.gender]}`)
    lines.push(...event(1, 'BIRT', p.bornDate, p.bornPlace))
    if (p.died) lines.push(...event(1, 'DEAT', p.diedDate, p.diedPlace, true))
    if (p.story) lines.push(...text(1, 'NOTE', p.story))
    for (const f of famc.get(p.id) ?? []) lines.push(`1 FAMC ${f.fam}`, `2 PEDI ${PEDI[f.kind]}`)
    for (const f of fams.get(p.id) ?? []) lines.push(`1 FAMS ${f}`)
  }
  units.forEach((u, i) => {
    lines.push(`0 @F${i + 1}@ FAM`)
    const people = u.parents.map((id) => data.people.find((p) => p.id === id))
    const [first, second] = people
    const husbFirst = !(first?.gender === 'female' || second?.gender === 'male')
    const ordered = husbFirst ? u.parents : [...u.parents].reverse()
    if (ordered.length === 1) {
      lines.push(`1 ${first?.gender === 'female' ? 'WIFE' : 'HUSB'} ${indi.get(ordered[0] as Id)}`)
    } else {
      lines.push(`1 HUSB ${indi.get(ordered[0] as Id)}`, `1 WIFE ${indi.get(ordered[1] as Id)}`)
    }
    const ps = u.partnership
    if (ps?.married) lines.push(...event(1, 'MARR', ps.startDate, ps.startPlace, true))
    else if (ps && (ps.startDate || ps.startPlace)) {
      lines.push('1 EVEN', '2 TYPE Partnership')
      if (ps.startDate) lines.push(`2 DATE ${toGedcomDate(ps.startDate)}`)
      if (ps.startPlace) lines.push(`2 PLAC ${ps.startPlace}`)
    }
    if (ps?.ended) lines.push(...event(1, 'DIV', ps.endDate, ps.endPlace, true))
    for (const c of u.children) lines.push(`1 CHIL ${indi.get(c.id)}`)
  })
  lines.push('0 TRLR')
  return `${lines.join('\n')}\n`
}

interface Node {
  level: number
  xref: string
  tag: string
  value: string
  children: Node[]
}

function parse(input: string): Node[] {
  const roots: Node[] = []
  const stack: Node[] = []
  for (const raw of input.replace(/^﻿/, '').split(/\r\n|\r|\n/)) {
    const m = /^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?: (.*))?$/.exec(raw)
    if (!m) continue
    const node: Node = {
      level: Number(m[1]),
      xref: m[2] ?? '',
      tag: (m[3] ?? '').toUpperCase(),
      value: m[4] ?? '',
      children: [],
    }
    while (stack.length && (stack[stack.length - 1] as Node).level >= node.level) stack.pop()
    const parent = stack[stack.length - 1]
    if (node.tag === 'CONT' && parent) parent.value += `\n${node.value}`
    else if (node.tag === 'CONC' && parent) parent.value += node.value
    else {
      if (parent) parent.children.push(node)
      else roots.push(node)
      stack.push(node)
    }
  }
  return roots
}

const child = (n: Node, tag: string) => n.children.find((c) => c.tag === tag)
const children = (n: Node, tag: string) => n.children.filter((c) => c.tag === tag)
const val = (n: Node | undefined, tag: string) => (n ? (child(n, tag)?.value.trim() ?? '') : '')

const GENDER: Record<string, Gender> = { M: 'male', F: 'female', X: 'other' }

function pedi(value: string): ParentKind {
  const v = value.toLowerCase()
  if (v.includes('adopt')) return 'adopted'
  if (v.includes('foster')) return 'foster'
  if (v.includes('step')) return 'step'
  return 'birth'
}

export interface GedcomImport {
  data: TreeData
  warnings: string[]
}

export function fromGedcom(
  input: string,
  options: { name?: string; maxPeople?: number } = {},
): GedcomImport {
  const roots = parse(input)
  const notes = new Map(
    roots.filter((r) => r.tag === 'NOTE' && r.xref).map((r) => [r.xref, r.value]),
  )
  const warnings: string[] = []
  const ids = new Map<string, Id>()
  const commands: Command[] = []
  const pediByFam = new Map<string, ParentKind>()

  for (const r of roots.filter((r) => r.tag === 'INDI')) {
    const id = newId()
    ids.set(r.xref, id)
    const names = children(r, 'NAME')
    const isBirth = (n: Node) => /birth|maiden/i.test(val(n, 'TYPE'))
    const main = names.find((n) => !isBirth(n)) ?? names[0]
    const birth = names.find(isBirth)
    const split = (n: Node | undefined) => {
      const m = /^([^/]*)\/?([^/]*)\/?(.*)$/.exec(n?.value ?? '')
      return {
        given: (val(n, 'GIVN') || `${m?.[1] ?? ''} ${m?.[3] ?? ''}`).replace(/\s+/g, ' ').trim(),
        surname: (val(n, 'SURN') || (m?.[2] ?? '')).trim(),
      }
    }
    const { given, surname } = split(main)
    const birthSurname = birth ? split(birth).surname : ''
    const birt = child(r, 'BIRT') ?? child(r, 'BAPM') ?? child(r, 'CHR')
    const deat = child(r, 'DEAT') ?? child(r, 'BURI') ?? child(r, 'CREM')
    const story = children(r, 'NOTE')
      .map((n) => (notes.get(n.value.trim()) ?? n.value).trim())
      .filter(Boolean)
      .join('\n\n')
    for (const f of children(r, 'FAMC')) {
      const kind = pedi(val(f, 'PEDI') || val(f, '_PEDI'))
      pediByFam.set(`${f.value.trim()}>${r.xref}`, kind)
    }
    commands.push({
      type: 'addPerson',
      person: {
        id,
        firstNames: given || '(unknown)',
        surname,
        birthSurname: birthSurname !== surname ? birthSurname : '',
        gender: GENDER[val(r, 'SEX').toUpperCase()] ?? 'unknown',
        bornDate: fromGedcomDate(val(birt, 'DATE')),
        bornPlace: val(birt, 'PLAC'),
        died: deat !== undefined,
        diedDate: fromGedcomDate(val(deat, 'DATE')),
        diedPlace: val(deat, 'PLAC'),
        story: story.slice(0, 20_000),
      },
    })
  }

  const links: Command[] = []
  for (const r of roots.filter((r) => r.tag === 'FAM')) {
    const parents = [...children(r, 'HUSB'), ...children(r, 'WIFE')]
      .map((n) => ids.get(n.value.trim()))
      .filter((id): id is Id => id !== undefined)
    const marr = child(r, 'MARR')
    const even = children(r, 'EVEN').find((e) => /partner|union|relationship/i.test(val(e, 'TYPE')))
    const start = marr ?? even
    const end = child(r, 'DIV') ?? child(r, 'ANUL')
    if (parents.length === 2) {
      commands.push({
        type: 'addPartnership',
        partnership: {
          personAId: parents[0] as Id,
          personBId: parents[1] as Id,
          married: marr !== undefined,
          startDate: fromGedcomDate(val(start, 'DATE')),
          startPlace: val(start, 'PLAC'),
          ended: end !== undefined,
          endDate: fromGedcomDate(val(end, 'DATE')),
          endPlace: val(end, 'PLAC'),
        },
      })
    }
    for (const c of children(r, 'CHIL')) {
      const childId = ids.get(c.value.trim())
      if (!childId) continue
      const kind =
        pediByFam.get(`${r.xref}>${c.value.trim()}`) ?? pedi(val(c, '_FREL') || val(c, '_MREL'))
      for (const parentId of parents) {
        links.push({ type: 'addParentLink', link: { childId, parentId, kind } })
      }
    }
  }

  let data = emptyTree({ name: options.name ?? 'Imported family' })
  for (const command of [...commands, ...links]) {
    try {
      data = applyCommand(
        data,
        command,
        options.maxPeople === undefined ? {} : { maxPeople: options.maxPeople },
      ).data
    } catch (error) {
      if (error instanceof DomainError && error.code === 'limit') throw error
      warnings.push(error instanceof Error ? error.message : String(error))
    }
  }
  return { data, warnings }
}
