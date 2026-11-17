import { describe, expect, test } from 'bun:test'
import { sampleFamily } from '@familytree/domain'
import { toGedcom } from '@familytree/domain/gedcom'
import { toExportFile } from '@familytree/domain/schema'
import { setup } from './helpers.ts'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

async function withTree(overrides = {}) {
  const ctx = setup(overrides)
  const treeId = await ctx.makeTree()
  return { ...ctx, treeId }
}

describe('trees', () => {
  test('list, rename, set Home person and delete', async () => {
    const { call, treeId } = await withTree()
    const list = await call('GET', '/api/trees')
    expect(list.data).toMatchObject([{ id: treeId, name: 'Popa', peopleCount: 0 }])
    const person = await call('POST', `/api/trees/${treeId}/people`, {
      body: { firstNames: 'Ion' },
    })
    const counted = await call('GET', '/api/trees')
    expect(counted.data).toMatchObject([{ id: treeId, peopleCount: 1 }])
    const renamed = await call('PATCH', `/api/trees/${treeId}`, {
      body: { name: 'Popa family' },
    })
    expect(renamed.data).toMatchObject({ name: 'Popa family', homePersonId: person.data.id })
    const bad = await call('PATCH', `/api/trees/${treeId}`, {
      body: { homePersonId: 'nobody' },
    })
    expect(bad.status).toBe(404)
    expect((await call('DELETE', `/api/trees/${treeId}`)).status).toBe(204)
    expect((await call('GET', `/api/trees/${treeId}`)).status).toBe(404)
  })

  test('limits the number of trees', async () => {
    const { call } = await withTree({ maxTrees: 1 })
    const res = await call('POST', '/api/trees', { body: { name: 'Two' } })
    expect(res.status).toBe(403)
    expect(res.data.error.code).toBe('limit')
  })

  test('commands run all or nothing', async () => {
    const { call, treeId } = await withTree()
    const ok = await call('POST', `/api/trees/${treeId}/commands`, {
      body: {
        commands: [
          { type: 'addPerson', person: { id: 'ion', firstNames: 'Ion' } },
          {
            type: 'addPerson',
            person: { id: 'maria', firstNames: 'Maria', bornDate: 'about 1931' },
          },
          {
            type: 'addPartnership',
            partnership: { personAId: 'ion', personBId: 'maria', married: true, startDate: '1952' },
          },
        ],
      },
    })
    expect(ok.status).toBe(200)
    expect(ok.data.data.people).toHaveLength(2)
    expect(ok.data.data.people[1].bornDate).toBe('~1931')

    const bad = await call('POST', `/api/trees/${treeId}/commands`, {
      body: {
        commands: [
          { type: 'addPerson', person: { id: 'ana', firstNames: 'Ana' } },
          { type: 'addParentLink', link: { childId: 'ana', parentId: 'ana' } },
        ],
      },
    })
    expect(bad.status).toBe(409)
    expect(bad.data.error.code).toBe('cycle')
    const after = await call('GET', `/api/trees/${treeId}`)
    expect(after.data.people).toHaveLength(2)

    const invalid = await call('POST', `/api/trees/${treeId}/commands`, {
      body: { commands: [{ type: 'explode' }] },
    })
    expect(invalid.status).toBe(400)
  })

  test('export and import JSON keep the tree and photos', async () => {
    const { call } = await withTree()
    const sample = sampleFamily()
    const daniel = sample.people.find((p) => p.firstNames === 'Daniel')
    if (daniel) daniel.photo = `data:image/png;base64,${PNG.toString('base64')}`
    const imported = await call('POST', '/api/trees/import', {
      body: toExportFile(sample),
    })
    expect(imported.status).toBe(201)
    const treeId = imported.data.tree.id
    expect(imported.data.people).toHaveLength(sample.people.length)
    const photo = imported.data.people.find(
      (p: { firstNames: string }) => p.firstNames === 'Daniel',
    ).photo
    expect(photo).toStartWith(`/api/trees/${treeId}/people/`)

    const exported = await call('GET', `/api/trees/${treeId}/export`)
    expect(exported.headers.get('content-disposition')).toContain('the-hale-family.familytree.json')
    expect(exported.data.format).toBe('familytree')
    const exportedDaniel = exported.data.people.find(
      (p: { firstNames: string }) => p.firstNames === 'Daniel',
    )
    expect(exportedDaniel.photo).toStartWith('data:image/png;base64,')
    expect(exported.data.parentLinks).toHaveLength(sample.parentLinks.length)
  })

  test('GEDCOM import and export', async () => {
    const { call } = await withTree()
    const res = await call('POST', '/api/trees/import/gedcom?name=Hale', {
      raw: toGedcom(sampleFamily()),
      headers: { 'content-type': 'text/plain' },
    })
    expect(res.status).toBe(201)
    expect(res.data.warnings).toEqual([])
    expect(res.data.data.tree.name).toBe('Hale')
    expect(res.data.data.partnerships).toHaveLength(6)
    const ged = await call('GET', `/api/trees/${res.data.data.tree.id}/export.ged`, {})
    expect(ged.status).toBe(200)
    expect(ged.data).toStartWith('0 HEAD')
  })

  test('limits people per tree', async () => {
    const { call, treeId } = await withTree({ maxPeoplePerTree: 1 })
    await call('POST', `/api/trees/${treeId}/people`, { body: { firstNames: 'A' } })
    const res = await call('POST', `/api/trees/${treeId}/people`, {
      body: { firstNames: 'B' },
    })
    expect(res.status).toBe(403)
  })
})

describe('people, links and partnerships', () => {
  test('full REST flow', async () => {
    const { call, treeId } = await withTree()
    const base = `/api/trees/${treeId}`
    const add = (body: object) => call('POST', `${base}/people`, { body })
    const ion = (await add({ firstNames: 'Ion', surname: 'Popa', gender: 'male' })).data
    const maria = (
      await add({ firstNames: 'Maria', birthSurname: 'Ionescu', bornDate: '14/03/1952' })
    ).data
    const ana = (await add({ firstNames: 'Ana', surname: 'Popa' })).data
    expect(maria.bornDate).toBe('1952-03-14')

    const bad = await add({ firstNames: '' })
    expect(bad.status).toBe(400)

    const found = await call('GET', `${base}/people?q=ionescu`)
    expect(found.data.map((p: { id: string }) => p.id)).toEqual([maria.id])

    const l1 = await call('POST', `${base}/parent-links`, {
      body: { childId: ana.id, parentId: ion.id },
    })
    expect(l1.status).toBe(201)
    expect(l1.data.kind).toBe('birth')
    await call('POST', `${base}/parent-links`, {
      body: { childId: ana.id, parentId: maria.id },
    })
    const third = await add({ firstNames: 'Elena' })
    const tooMany = await call('POST', `${base}/parent-links`, {
      body: { childId: ana.id, parentId: third.data.id },
    })
    expect(tooMany.status).toBe(409)
    expect(tooMany.data.error.code).toBe('too_many_birth_parents')

    const changed = await call('PATCH', `${base}/parent-links/${l1.data.id}`, {
      body: { kind: 'adopted' },
    })
    expect(changed.data.kind).toBe('adopted')

    const marriage = await call('POST', `${base}/partnerships`, {
      body: { personAId: ion.id, personBId: maria.id, married: true, startDate: '1975' },
    })
    expect(marriage.status).toBe(201)
    const divorce = await call('PATCH', `${base}/partnerships/${marriage.data.id}`, {
      body: { endDate: '1980' },
    })
    expect(divorce.data).toMatchObject({ ended: true, endDate: '1980', married: true })

    const rel = await call('GET', `${base}/people/${ana.id}/relatives`)
    expect(rel.data.parents).toHaveLength(2)
    const ionRel = await call('GET', `${base}/people/${ion.id}/relatives`)
    expect(ionRel.data.children[0].person.id).toBe(ana.id)
    expect(ionRel.data.partners[0].person.id).toBe(maria.id)

    const died = await call('PATCH', `${base}/people/${ion.id}`, {
      body: { diedDate: 'March 2001' },
    })
    expect(died.data).toMatchObject({ died: true, diedDate: '2001-03', surname: 'Popa' })

    expect((await call('DELETE', `${base}/partnerships/${marriage.data.id}`)).status).toBe(204)
    expect((await call('DELETE', `${base}/parent-links/${l1.data.id}`)).status).toBe(204)
    expect((await call('DELETE', `${base}/people/${ion.id}`)).status).toBe(204)
    expect((await call('GET', `${base}/people/${ion.id}`)).status).toBe(404)
  })

  test('photos: upload, read, reject bad ones, delete with the person', async () => {
    const { call, treeId, db } = await withTree()
    const base = `/api/trees/${treeId}`
    const p = (await call('POST', `${base}/people`, { body: { firstNames: 'Ion' } })).data
    const put = await call('PUT', `${base}/people/${p.id}/photo`, {
      raw: PNG,
      headers: { 'content-type': 'image/png' },
    })
    expect(put.status).toBe(200)
    expect(put.data.photo).toStartWith(`${base}/people/${p.id}/photo?v=`)

    const img = await call('GET', put.data.photo)
    expect(img.status).toBe(200)
    expect(img.headers.get('content-type')).toBe('image/png')
    expect(img.headers.get('cache-control')).toContain('private')

    expect((await call('GET', `${base}/people/nobody/photo`)).status).toBe(404)

    const gif = await call('PUT', `${base}/people/${p.id}/photo`, {
      raw: PNG,
      headers: { 'content-type': 'image/gif' },
    })
    expect(gif.status).toBe(400)

    const external = await call('PATCH', `${base}/people/${p.id}`, {
      body: { photo: 'https://tracker.example/x.png' },
    })
    expect(external.status).toBe(400)

    const unchanged = await call('PATCH', `${base}/people/${p.id}`, {
      body: { story: 'Hello', photo: put.data.photo },
    })
    expect(unchanged.status).toBe(200)

    await call('DELETE', `${base}/people/${p.id}`)
    const { photos } = await import('../src/db/schema.ts')
    expect(db.select().from(photos).all()).toHaveLength(0)
  })

  test('the docs and the agent reference are served', async () => {
    const { call } = setup()
    const spec = await call('GET', '/api/openapi.json')
    expect(spec.status).toBe(200)
    expect(spec.data.components.securitySchemes).toBeUndefined()
    expect(JSON.stringify(spec.data)).not.toContain('"security"')
    expect(Object.keys(spec.data.paths)).toContain('/api/trees/{treeId}/commands')
    expect(spec.data.components.schemas.Person).toBeDefined()
    const llms = await call('GET', '/llms.txt')
    expect(llms.data).toContain('http://localhost/api/openapi.json')
    expect(llms.data).not.toContain('{{BASE_URL}}')
    expect(llms.data).not.toStartWith('---')
    expect((await call('GET', '/api/docs')).status).toBe(200)
    expect((await call('GET', '/api/health')).data).toEqual({ ok: true })
    expect((await call('GET', '/api/nothing')).status).toBe(404)
  })
})

describe('no accounts', () => {
  test('the API works without any auth header, and the old account routes are gone', async () => {
    const { app } = setup()
    const created = await app.request('http://localhost/api/trees', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://other.example' },
      body: JSON.stringify({ name: 'Open' }),
    })
    expect(created.status).toBe(201)
    const list = await app.request('http://localhost/api/trees')
    expect(list.status).toBe(200)
    expect(await list.json()).toMatchObject([{ name: 'Open', peopleCount: 0 }])
    for (const [method, path] of [
      ['POST', '/api/auth/signup'],
      ['POST', '/api/auth/login'],
      ['POST', '/api/auth/logout'],
      ['GET', '/api/auth/me'],
      ['DELETE', '/api/auth/account'],
      ['GET', '/api/tokens'],
    ] as const) {
      const res = await app.request(`http://localhost${path}`, { method })
      expect(res.status).toBe(404)
    }
  })
})
