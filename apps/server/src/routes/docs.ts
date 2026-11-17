import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { swaggerUI } from '@hono/swagger-ui'
import type { OpenAPIHono } from '@hono/zod-openapi'

const REFERENCE = join(
  import.meta.dir,
  '..',
  '..',
  '..',
  '..',
  'skills',
  'familytree-api',
  'SKILL.md',
)

export function agentReference(baseUrl: string): string {
  const text = readFileSync(REFERENCE, 'utf8').replace(/^---\n[\s\S]*?\n---\n+/, '')
  return text.replaceAll('{{BASE_URL}}', baseUrl)
}

function origin(url: string, forwardedProto?: string, forwardedHost?: string) {
  const u = new URL(url)
  return `${forwardedProto ?? u.protocol.replace(':', '')}://${forwardedHost ?? u.host}`
}

export function docsRoutes(app: OpenAPIHono, trustProxy: boolean) {
  app.doc31('/api/openapi.json', (c) => ({
    openapi: '3.1.0',
    info: {
      title: 'Family Tree API',
      version: '1.0.0',
      description:
        'A simple, private family tree. Every route works on the trees stored on this server. There is no sign-in: the operator protects the server with their own network, VPN or reverse proxy. Agents: read /llms.txt for a short guide with examples.',
      license: { name: 'AGPL-3.0', identifier: 'AGPL-3.0-only' },
    },
    servers: [
      {
        url: trustProxy
          ? origin(c.req.url, c.req.header('x-forwarded-proto'), c.req.header('x-forwarded-host'))
          : origin(c.req.url),
      },
    ],
  }))
  app.get('/api/docs', swaggerUI({ url: '/api/openapi.json', title: 'Family Tree API' }))
  app.get('/llms.txt', (c) => {
    const base = trustProxy
      ? origin(c.req.url, c.req.header('x-forwarded-proto'), c.req.header('x-forwarded-host'))
      : origin(c.req.url)
    c.header('Content-Type', 'text/markdown; charset=utf-8')
    return c.body(agentReference(base))
  })
}
