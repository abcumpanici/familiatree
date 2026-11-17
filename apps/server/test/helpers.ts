import { createApp } from '../src/app.ts'
import { type Config, testConfig } from '../src/config.ts'
import { openDb } from '../src/db/index.ts'

export function setup(overrides: Partial<Config> = {}) {
  const db = openDb(':memory:')
  const app = createApp({ db, config: testConfig(overrides) })

  async function call(
    method: string,
    path: string,
    options: {
      body?: unknown
      headers?: Record<string, string>
      raw?: BodyInit
    } = {},
  ) {
    const headers: Record<string, string> = { ...options.headers }
    if (options.body !== undefined) headers['content-type'] = 'application/json'
    const res = await app.request(`http://localhost${path}`, {
      method,
      headers,
      body: options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    })
    const type = res.headers.get('content-type') ?? ''
    const data = type.includes('json') ? await res.json() : await res.text()
    return { status: res.status, data: data as any, headers: res.headers }
  }

  async function makeTree(name = 'Popa') {
    const res = await call('POST', '/api/trees', { body: { name } })
    return res.data.id as string
  }

  return { app, db, call, makeTree }
}
