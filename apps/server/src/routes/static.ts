import { resolve, sep } from 'node:path'
import type { OpenAPIHono } from '@hono/zod-openapi'

const NO_CACHE = new Set(['/index.html', '/sw.js', '/manifest.webmanifest', '/registerSW.js'])

export function staticRoutes(app: OpenAPIHono, dist: string) {
  const root = resolve(dist)
  const index = Bun.file(resolve(root, 'index.html'))
  app.get('*', async (c) => {
    const path = new URL(c.req.url).pathname
    if (path.startsWith('/api/')) return c.notFound()
    let decoded: string
    try {
      decoded = decodeURIComponent(path)
    } catch {
      return c.notFound()
    }
    const target = resolve(root, `.${decoded}`)
    if (target.startsWith(root + sep) && !decoded.endsWith('/')) {
      const file = Bun.file(target)
      if (await file.exists()) {
        const cache = decoded.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : NO_CACHE.has(decoded)
            ? 'no-cache'
            : 'public, max-age=3600'
        return new Response(file, { headers: { 'Cache-Control': cache } })
      }
      if (/\.[a-z0-9]+$/i.test(decoded)) return c.notFound()
    }
    return new Response(index, {
      headers: { 'Cache-Control': 'no-cache', 'Content-Type': 'text/html; charset=utf-8' },
    })
  })
}
