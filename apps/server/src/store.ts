import {
  applyCommand,
  type Change,
  type Command,
  type Id,
  type ParentKind,
  type Person,
  type Tree,
  type TreeData,
} from '@familytree/domain'
import { and, asc, count, eq, sql } from 'drizzle-orm'
import type { Config } from './config.ts'
import type { Db } from './db/index.ts'
import { parentLinks, partnerships, people, photos, trees } from './db/schema.ts'
import { ApiError, notFound } from './errors.ts'

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0] | Db

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_PHOTO_BYTES = 300 * 1024

export function photoUrl(treeId: Id, personId: Id, hash: string) {
  return `/api/trees/${treeId}/people/${personId}/photo?v=${hash.slice(0, 12)}`
}

function treeRow(db: Tx, treeId: Id) {
  return db.select().from(trees).where(eq(trees.id, treeId)).get()
}

function toTree(row: typeof trees.$inferSelect): Tree {
  return {
    id: row.id,
    name: row.name,
    homePersonId: row.homePersonId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function requireTree(db: Tx, treeId: Id): Tree {
  const row = treeRow(db, treeId)
  if (!row) notFound(`Tree ${treeId} was not found`)
  return toTree(row)
}

export function listTrees(db: Db) {
  const rows = db.select().from(trees).orderBy(asc(trees.createdAt)).all()
  const counts = new Map(
    db
      .select({ treeId: people.treeId, n: count() })
      .from(people)
      .groupBy(people.treeId)
      .all()
      .map((r) => [r.treeId, r.n]),
  )
  return rows.map((r) => ({ ...toTree(r), peopleCount: counts.get(r.id) ?? 0 }))
}

export function countTrees(db: Db) {
  return db.select({ n: count() }).from(trees).get()?.n ?? 0
}

export function loadTreeData(db: Tx, treeId: Id): TreeData {
  const tree = requireTree(db, treeId)
  const personRows = db
    .select()
    .from(people)
    .where(eq(people.treeId, treeId))
    .orderBy(sql`rowid`)
    .all()
  const linkRows = db
    .select()
    .from(parentLinks)
    .where(eq(parentLinks.treeId, treeId))
    .orderBy(sql`rowid`)
    .all()
  const partnershipRows = db
    .select()
    .from(partnerships)
    .where(eq(partnerships.treeId, treeId))
    .orderBy(sql`rowid`)
    .all()
  return {
    tree,
    people: personRows.map(({ treeId: _, gender, ...p }) => ({
      ...p,
      gender: gender as Person['gender'],
    })),
    parentLinks: linkRows.map(({ treeId: _, kind, ...l }) => ({ ...l, kind: kind as ParentKind })),
    partnerships: partnershipRows.map(({ treeId: _, ...p }) => p),
  }
}

function decodeDataUrl(value: string) {
  const m = /^data:([a-z/+.-]+);base64,(.+)$/i.exec(value)
  if (!m?.[1] || !m[2]) return null
  const contentType = m[1].toLowerCase()
  if (!PHOTO_TYPES.includes(contentType)) return null
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) return null
  return { contentType, bytes }
}

export function savePhoto(db: Tx, treeId: Id, personId: Id, contentType: string, bytes: Buffer) {
  if (!PHOTO_TYPES.includes(contentType)) {
    throw new ApiError(400, 'invalid', 'A photo must be a JPEG, PNG or WebP image')
  }
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
    throw new ApiError(400, 'invalid', 'A photo must be at most 300 KB')
  }
  const hash = new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  db.insert(photos)
    .values({ treeId, personId, contentType, hash, bytes })
    .onConflictDoUpdate({
      target: [photos.treeId, photos.personId],
      set: { contentType, hash, bytes },
    })
    .run()
  return photoUrl(treeId, personId, hash)
}

function deletePhoto(db: Tx, treeId: Id, personId: Id) {
  db.delete(photos)
    .where(and(eq(photos.treeId, treeId), eq(photos.personId, personId)))
    .run()
}

export function readPhoto(db: Db, treeId: Id, personId: Id) {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.treeId, treeId), eq(photos.personId, personId)))
    .get()
}

function resolvePhoto(db: Tx, treeId: Id, person: Person, previous: string | undefined): string {
  const value = person.photo
  if (value === '') {
    deletePhoto(db, treeId, person.id)
    return ''
  }
  if (value === previous) return value
  if (value.startsWith('data:')) {
    const decoded = decodeDataUrl(value)
    if (!decoded) {
      throw new ApiError(
        400,
        'invalid',
        'photo must be a JPEG, PNG or WebP data URL of at most 300 KB',
      )
    }
    return savePhoto(db, treeId, person.id, decoded.contentType, decoded.bytes)
  }
  const row = readPhoto(db as Db, treeId, person.id)
  if (row && value === photoUrl(treeId, person.id, row.hash)) return value
  throw new ApiError(
    400,
    'invalid',
    'photo must be empty, a data URL, or upload it with PUT .../photo',
  )
}

export function persistChanges(db: Tx, treeId: Id, changes: Change[], before: TreeData | null) {
  const previous = new Map(before?.people.map((p) => [p.id, p.photo]))
  const resolved = new Map<Id, string>()
  for (const change of changes) {
    if (change.op === 'delete') {
      const table =
        change.entity === 'person'
          ? people
          : change.entity === 'parentLink'
            ? parentLinks
            : partnerships
      db.delete(table)
        .where(and(eq(table.treeId, treeId), eq(table.id, change.id)))
        .run()
      if (change.entity === 'person') deletePhoto(db, treeId, change.id)
      continue
    }
    switch (change.entity) {
      case 'person': {
        const photo = resolvePhoto(db, treeId, change.value, previous.get(change.value.id))
        previous.set(change.value.id, photo)
        resolved.set(change.value.id, photo)
        const row = { ...change.value, photo, treeId }
        db.insert(people)
          .values(row)
          .onConflictDoUpdate({ target: [people.treeId, people.id], set: row })
          .run()
        break
      }
      case 'parentLink': {
        const row = { ...change.value, treeId }
        db.insert(parentLinks)
          .values(row)
          .onConflictDoUpdate({ target: [parentLinks.treeId, parentLinks.id], set: row })
          .run()
        break
      }
      case 'partnership': {
        const row = { ...change.value, treeId }
        db.insert(partnerships)
          .values(row)
          .onConflictDoUpdate({ target: [partnerships.treeId, partnerships.id], set: row })
          .run()
        break
      }
      case 'tree': {
        db.update(trees)
          .set({
            name: change.value.name,
            homePersonId: change.value.homePersonId,
            updatedAt: change.value.updatedAt,
          })
          .where(eq(trees.id, treeId))
          .run()
        break
      }
    }
  }
  return resolved
}

export function runCommands(db: Db, config: Config, treeId: Id, commands: Command[]): TreeData {
  return db.transaction((tx) => {
    const before = loadTreeData(tx, treeId)
    let data = before
    const all: Change[] = []
    for (const command of commands) {
      const result = applyCommand(data, command, { maxPeople: config.maxPeoplePerTree })
      data = result.data
      all.push(...result.changes)
    }
    const photos = persistChanges(tx, treeId, all, before)
    if (photos.size === 0) return data
    return {
      ...data,
      people: data.people.map((p) =>
        photos.has(p.id) ? { ...p, photo: photos.get(p.id) as string } : p,
      ),
    }
  })
}

export function insertTreeData(db: Db, data: TreeData): TreeData {
  return db.transaction((tx) => {
    tx.insert(trees)
      .values({
        id: data.tree.id,
        name: data.tree.name,
        homePersonId: data.tree.homePersonId,
        createdAt: data.tree.createdAt,
        updatedAt: data.tree.updatedAt,
      })
      .run()
    const changes: Change[] = [
      ...data.people.map((value) => ({ op: 'put', entity: 'person', value }) as const),
      ...data.parentLinks.map((value) => ({ op: 'put', entity: 'parentLink', value }) as const),
      ...data.partnerships.map((value) => ({ op: 'put', entity: 'partnership', value }) as const),
    ]
    persistChanges(tx, data.tree.id, changes, null)
    return loadTreeData(tx, data.tree.id)
  })
}

export function withEmbeddedPhotos(db: Db, data: TreeData): TreeData {
  return {
    ...data,
    people: data.people.map((p) => {
      if (!p.photo) return p
      const row = readPhoto(db, data.tree.id, p.id)
      if (!row) return { ...p, photo: '' }
      return {
        ...p,
        photo: `data:${row.contentType};base64,${Buffer.from(row.bytes).toString('base64')}`,
      }
    }),
  }
}
