import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setup } from './helpers.ts'

test('serves the web app with SPA fallback and safe paths', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ft-web-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>app</title>')
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)')
  writeFileSync(join(dir, '..', 'secret.txt'), 'secret')
  const { call } = setup({ webDist: dir })

  const home = await call('GET', '/')
  expect(home.data).toContain('<title>app</title>')
  expect(home.headers.get('cache-control')).toBe('no-cache')

  const asset = await call('GET', '/assets/app.js')
  expect(asset.data).toBe('console.log(1)')
  expect(asset.headers.get('cache-control')).toContain('immutable')

  expect((await call('GET', '/trees/abc')).data).toContain('<title>app</title>')
  expect((await call('GET', '/assets/missing.js')).status).toBe(404)
  expect((await call('GET', '/..%2fsecret.txt')).data).not.toBe('secret')
  expect((await call('GET', '/api/nothing')).status).toBe(404)
})
