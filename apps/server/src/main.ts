import { join } from 'node:path'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { openDb } from './db/index.ts'

const config = loadConfig()
const db = openDb(join(config.dataDir, 'familytree.sqlite'))
const app = createApp({ db, config })

const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
  maxRequestBodySize: 64 * 1024 * 1024,
})

console.log(`Family Tree server on http://localhost:${server.port}`)
if (!config.webDist) console.log('Web app build not found; serving the API only')
