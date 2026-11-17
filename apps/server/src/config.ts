import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface Config {
  port: number
  dataDir: string
  maxPeoplePerTree: number
  maxTrees: number
  trustProxy: boolean
  webDist: string | null
}

function bool(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function int(value: string | undefined, fallback: number) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const defaultDist = join(import.meta.dir, '..', '..', 'web', 'dist')
  const webDist = env.WEB_DIST ?? defaultDist
  return {
    port: int(env.PORT, 3000),
    dataDir: env.DATA_DIR ?? './data',
    maxPeoplePerTree: int(env.MAX_PEOPLE_PER_TREE, 2000),
    maxTrees: int(env.MAX_TREES, 100),
    trustProxy: bool(env.TRUST_PROXY, false),
    webDist: existsSync(join(webDist, 'index.html')) ? webDist : null,
  }
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: 0,
    dataDir: ':memory:',
    maxPeoplePerTree: 2000,
    maxTrees: 100,
    trustProxy: false,
    webDist: null,
    ...overrides,
  }
}
