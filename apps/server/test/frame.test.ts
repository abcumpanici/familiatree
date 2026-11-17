import { expect, test } from 'bun:test'
import { loadConfig } from '../src/config.ts'
import { setup } from './helpers.ts'

test('no other site can show the app in a frame by default', async () => {
  const { call } = setup()
  const res = await call('GET', '/api/health')
  expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
  expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
})

test('FRAME_ANCESTORS lets the listed sites show the app in a frame', async () => {
  const config = loadConfig({ FRAME_ANCESTORS: 'http://ha.home  http://192.168.18.42:8123' })
  expect(config.frameAncestors).toEqual(['http://ha.home', 'http://192.168.18.42:8123'])
  const { call } = setup({ frameAncestors: config.frameAncestors })
  const res = await call('GET', '/api/health')
  expect(res.headers.get('content-security-policy')).toContain(
    'frame-ancestors http://ha.home http://192.168.18.42:8123',
  )
  expect(res.headers.get('x-frame-options')).toBeNull()
})
