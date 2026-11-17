import { secureHeaders } from 'hono/secure-headers'
import type { Config } from './config.ts'
import type { Db } from './db/index.ts'
import { errorBody, handleError } from './errors.ts'
import { router } from './routes/common.ts'
import { docsRoutes } from './routes/docs.ts'
import { peopleRoutes } from './routes/people.ts'
import { staticRoutes } from './routes/static.ts'
import { treeRoutes } from './routes/trees.ts'

export function createApp({ db, config }: { db: Db; config: Config }) {
  const app = router()
  app.onError(handleError)
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
      crossOriginEmbedderPolicy: false,
    }),
  )
  app.use('/api/docs', async (c, next) => {
    await next()
    c.res.headers.delete('Content-Security-Policy')
  })
  app.get('/api/health', (c) => c.json({ ok: true }))
  app.route('/', treeRoutes(db, config))
  app.route('/', peopleRoutes(db, config))
  docsRoutes(app, config.trustProxy)
  app.all('/api/*', (c) => c.json(errorBody('not_found', 'No such API route'), 404))
  if (config.webDist) staticRoutes(app, config.webDist)
  return app
}
