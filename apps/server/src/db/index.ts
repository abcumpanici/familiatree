import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from './schema.ts'

export type Db = ReturnType<typeof openDb>

const MIGRATIONS = join(import.meta.dir, '..', '..', 'drizzle')

export function openDb(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const sqlite = new Database(path, { create: true, strict: true })
  sqlite.run('PRAGMA journal_mode = WAL')
  sqlite.run('PRAGMA busy_timeout = 5000')
  const db = drizzle(sqlite, { schema })
  sqlite.run('PRAGMA foreign_keys = OFF')
  migrate(db, { migrationsFolder: MIGRATIONS })
  const broken = sqlite.query('PRAGMA foreign_key_check').all()
  if (broken.length > 0) throw new Error(`Migration broke ${broken.length} foreign keys`)
  sqlite.run('PRAGMA foreign_keys = ON')
  return db
}
