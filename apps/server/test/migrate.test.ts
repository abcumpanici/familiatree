import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { openDb } from '../src/db/index.ts'

const MIGRATIONS = join(import.meta.dir, '..', 'drizzle')

function initOnlyFolder() {
  const dir = mkdtempSync(join(tmpdir(), 'ft-migrations-'))
  cpSync(MIGRATIONS, dir, { recursive: true })
  const journalPath = join(dir, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'))
  journal.entries = journal.entries.slice(0, 1)
  writeFileSync(journalPath, JSON.stringify(journal))
  return dir
}

function counts(path: string) {
  const sqlite = new Database(path)
  const n = (table: string) =>
    (sqlite.query(`select count(*) as n from ${table}`).get() as { n: number }).n
  const result = {
    trees: n('trees'),
    people: n('people'),
    parentLinks: n('parent_links'),
    partnerships: n('partnerships'),
    photos: n('photos'),
  }
  sqlite.close()
  return result
}

test('removing accounts keeps every tree, person, link, partnership and photo', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'ft-db-')), 'familytree.sqlite')
  const old = new Database(path, { create: true })
  old.run('PRAGMA foreign_keys = ON')
  migrate(drizzle(old), { migrationsFolder: initOnlyFolder() })
  old.run(`insert into users values ('u1', 'a@example.com', 'hash', 'now')`)
  old.run(`insert into sessions values ('s1', 'u1', 'now', 'later')`)
  old.run(`insert into api_tokens values ('t1', 'u1', 'Agent', 'h', 'now', null)`)
  old.run(`insert into trees values ('tree1', 'u1', 'Popa', 'ion', 'now', 'now')`)
  old.run(
    `insert into people values ('ion', 'tree1', 'Ion', 'Popa', '', 'male', '', '', 0, '', '', '', '', 'now', 'now'), ('ana', 'tree1', 'Ana', 'Popa', '', 'female', '', '', 0, '', '', '', '', 'now', 'now')`,
  )
  old.run(`insert into parent_links values ('l1', 'tree1', 'ana', 'ion', 'birth')`)
  old.run(`insert into partnerships values ('p1', 'tree1', 'ion', 'ana', 0, '', '', 0, '', '')`)
  old.run(`insert into photos values ('tree1', 'ion', 'image/png', 'h', x'00')`)
  old.close()
  const before = counts(path)

  const db = openDb(path)
  expect(counts(path)).toEqual(before)
  expect(before).toEqual({ trees: 1, people: 2, parentLinks: 1, partnerships: 1, photos: 1 })

  const tables = db.$client
    .query(`select name from sqlite_master where type = 'table'`)
    .all()
    .map((r) => (r as { name: string }).name)
  expect(tables).not.toContain('users')
  expect(tables).not.toContain('sessions')
  expect(tables).not.toContain('api_tokens')
  expect(db.$client.query('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
  db.$client.run(`delete from trees where id = 'tree1'`)
  expect(counts(path)).toEqual({ trees: 0, people: 0, parentLinks: 0, partnerships: 0, photos: 0 })
})
