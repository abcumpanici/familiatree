import {
  type Command,
  displayName,
  type Id,
  newId,
  PARENT_KINDS,
  type Person,
  type TreeData,
} from '@familytree/domain'
import { createRoute, z } from '@hono/zod-openapi'
import type { Config } from '../config.ts'
import type { Db } from '../db/index.ts'
import { ApiError, notFound } from '../errors.ts'
import { loadTreeData, readPhoto, requireTree, runCommands, savePhoto } from '../store.ts'
import {
  body,
  json,
  LinkParams,
  ParentLinkInputSchema,
  ParentLinkSchema,
  PartnershipInputSchema,
  PartnershipParams,
  PartnershipPatchSchema,
  PartnershipSchema,
  PersonInputSchema,
  PersonParams,
  PersonPatchSchema,
  PersonSchema,
  RelativesSchema,
  router,
  TreeParams,
  treeErrors,
} from './common.ts'

const people = ['People']
const links = ['Parent links']
const partners = ['Partnerships']

const search = createRoute({
  method: 'get',
  path: '/api/trees/{treeId}/people',
  tags: people,
  summary: 'List or search persons',
  description: 'Without q, lists everyone. With q, matches first names, surname and birth surname.',
  request: { params: TreeParams, query: z.object({ q: z.string().max(200).optional() }) },
  responses: { 200: json(z.array(PersonSchema)), ...treeErrors },
})

const addPerson = createRoute({
  method: 'post',
  path: '/api/trees/{treeId}/people',
  tags: people,
  summary: 'Add a person',
  request: { params: TreeParams, ...body(PersonInputSchema) },
  responses: { 201: json(PersonSchema, 'The new person'), ...treeErrors },
})

const getPerson = createRoute({
  method: 'get',
  path: '/api/trees/{treeId}/people/{personId}',
  tags: people,
  summary: 'Get a person',
  request: { params: PersonParams },
  responses: { 200: json(PersonSchema), ...treeErrors },
})

const updatePerson = createRoute({
  method: 'patch',
  path: '/api/trees/{treeId}/people/{personId}',
  tags: people,
  summary: 'Change a person',
  description: 'Send only the fields to change.',
  request: { params: PersonParams, ...body(PersonPatchSchema) },
  responses: { 200: json(PersonSchema), ...treeErrors },
})

const deletePerson = createRoute({
  method: 'delete',
  path: '/api/trees/{treeId}/people/{personId}',
  tags: people,
  summary: 'Delete a person and their links',
  request: { params: PersonParams },
  responses: { 204: { description: 'Deleted' }, ...treeErrors },
})

const relatives = createRoute({
  method: 'get',
  path: '/api/trees/{treeId}/people/{personId}/relatives',
  tags: people,
  summary: 'Get a person with their parents, children, partners and siblings',
  request: { params: PersonParams },
  responses: { 200: json(RelativesSchema), ...treeErrors },
})

const putPhoto = createRoute({
  method: 'put',
  path: '/api/trees/{treeId}/people/{personId}/photo',
  tags: people,
  summary: 'Upload the photo of a person',
  description: 'Raw image body: JPEG, PNG or WebP, at most 300 KB.',
  request: {
    params: PersonParams,
    body: {
      required: true,
      content: {
        'image/jpeg': { schema: z.any() },
        'image/png': { schema: z.any() },
        'image/webp': { schema: z.any() },
      },
    },
  },
  responses: { 200: json(PersonSchema), ...treeErrors },
})

const getPhoto = createRoute({
  method: 'get',
  path: '/api/trees/{treeId}/people/{personId}/photo',
  tags: people,
  summary: 'Download the photo of a person',
  request: { params: PersonParams },
  responses: { 200: { description: 'The image' }, ...treeErrors },
})

const deletePhoto = createRoute({
  method: 'delete',
  path: '/api/trees/{treeId}/people/{personId}/photo',
  tags: people,
  summary: 'Remove the photo of a person',
  request: { params: PersonParams },
  responses: { 200: json(PersonSchema), ...treeErrors },
})

const addLink = createRoute({
  method: 'post',
  path: '/api/trees/{treeId}/parent-links',
  tags: links,
  summary: 'Link a child to a parent',
  description:
    'A child can have at most 2 birth parents, and any number of adopted, step or foster parents. A person cannot become their own ancestor.',
  request: { params: TreeParams, ...body(ParentLinkInputSchema) },
  responses: { 201: json(ParentLinkSchema, 'The new link'), ...treeErrors },
})

const updateLink = createRoute({
  method: 'patch',
  path: '/api/trees/{treeId}/parent-links/{linkId}',
  tags: links,
  summary: 'Change the kind of a parent link',
  request: { params: LinkParams, ...body(z.object({ kind: z.enum(PARENT_KINDS) })) },
  responses: { 200: json(ParentLinkSchema), ...treeErrors },
})

const deleteLink = createRoute({
  method: 'delete',
  path: '/api/trees/{treeId}/parent-links/{linkId}',
  tags: links,
  summary: 'Remove a parent link',
  request: { params: LinkParams },
  responses: { 204: { description: 'Removed' }, ...treeErrors },
})

const addPartnership = createRoute({
  method: 'post',
  path: '/api/trees/{treeId}/partnerships',
  tags: partners,
  summary: 'Add a partnership between two persons',
  description:
    'Married or not. Set startDate for the wedding, and ended/endDate for a divorce. A person can have many partnerships.',
  request: { params: TreeParams, ...body(PartnershipInputSchema) },
  responses: { 201: json(PartnershipSchema, 'The new partnership'), ...treeErrors },
})

const updatePartnership = createRoute({
  method: 'patch',
  path: '/api/trees/{treeId}/partnerships/{partnershipId}',
  tags: partners,
  summary: 'Change a partnership',
  request: { params: PartnershipParams, ...body(PartnershipPatchSchema) },
  responses: { 200: json(PartnershipSchema), ...treeErrors },
})

const deletePartnership = createRoute({
  method: 'delete',
  path: '/api/trees/{treeId}/partnerships/{partnershipId}',
  tags: partners,
  summary: 'Remove a partnership',
  request: { params: PartnershipParams },
  responses: { 204: { description: 'Removed' }, ...treeErrors },
})

function findPerson(data: TreeData, id: Id): Person {
  const person = data.people.find((p) => p.id === id)
  if (!person) notFound(`Person ${id} was not found`)
  return person
}

function find<T extends { id: Id }>(list: T[], id: Id, what: string): T {
  const item = list.find((x) => x.id === id)
  if (!item) notFound(`${what} ${id} was not found`)
  return item
}

export function peopleRoutes(db: Db, config: Config) {
  const r = router()
  const run = (treeId: Id, commands: Command[]) => runCommands(db, config, treeId, commands)

  r.openapi(search, (c) => {
    const { treeId } = c.req.valid('param')
    const q = c.req.valid('query').q?.trim().toLowerCase()
    const data = loadTreeData(db, treeId)
    const result = q
      ? data.people.filter((p) => `${displayName(p)} ${p.birthSurname}`.toLowerCase().includes(q))
      : data.people
    return c.json(result, 200)
  })

  r.openapi(addPerson, (c) => {
    const { treeId } = c.req.valid('param')
    const input = c.req.valid('json')
    const id = input.id ?? newId()
    const data = run(treeId, [{ type: 'addPerson', person: { ...input, id } }])
    return c.json(findPerson(data, id), 201)
  })

  r.openapi(getPerson, (c) => {
    const { treeId, personId } = c.req.valid('param')
    return c.json(findPerson(loadTreeData(db, treeId), personId), 200)
  })

  r.openapi(updatePerson, (c) => {
    const { treeId, personId } = c.req.valid('param')
    const data = run(treeId, [{ type: 'updatePerson', id: personId, patch: c.req.valid('json') }])
    return c.json(findPerson(data, personId), 200)
  })

  r.openapi(deletePerson, (c) => {
    const { treeId, personId } = c.req.valid('param')
    run(treeId, [{ type: 'deletePerson', id: personId }])
    return c.body(null, 204)
  })

  r.openapi(relatives, (c) => {
    const { treeId, personId } = c.req.valid('param')
    const data = loadTreeData(db, treeId)
    const person = findPerson(data, personId)
    const byId = new Map(data.people.map((p) => [p.id, p]))
    const get = (id: Id) => byId.get(id) as Person
    const parents = data.parentLinks
      .filter((l) => l.childId === personId)
      .map((link) => ({ link, person: get(link.parentId) }))
    const children = data.parentLinks
      .filter((l) => l.parentId === personId)
      .map((link) => ({ link, person: get(link.childId) }))
    const partnersList = data.partnerships
      .filter((p) => p.personAId === personId || p.personBId === personId)
      .map((partnership) => ({
        partnership,
        person: get(
          partnership.personAId === personId ? partnership.personBId : partnership.personAId,
        ),
      }))
    const parentIds = new Set(parents.map((p) => p.link.parentId))
    const siblingIds = new Set(
      data.parentLinks
        .filter((l) => parentIds.has(l.parentId) && l.childId !== personId)
        .map((l) => l.childId),
    )
    return c.json(
      {
        person,
        parents,
        children,
        partners: partnersList,
        siblings: [...siblingIds].map(get),
      },
      200,
    )
  })

  r.openapi(putPhoto, async (c) => {
    const { treeId, personId } = c.req.valid('param')
    findPerson(loadTreeData(db, treeId), personId)
    const contentType =
      (c.req.header('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
    const bytes = Buffer.from(await c.req.arrayBuffer())
    const url = savePhoto(db, treeId, personId, contentType, bytes)
    const data = run(treeId, [{ type: 'updatePerson', id: personId, patch: { photo: url } }])
    return c.json(findPerson(data, personId), 200)
  })

  r.openapi(getPhoto, (c) => {
    const { treeId, personId } = c.req.valid('param')
    requireTree(db, treeId)
    const row = readPhoto(db, treeId, personId)
    if (!row) throw new ApiError(404, 'not_found', 'This person has no photo')
    c.header('Content-Type', row.contentType)
    c.header('Cache-Control', 'private, max-age=31536000, immutable')
    return c.body(new Uint8Array(row.bytes), 200)
  })

  r.openapi(deletePhoto, (c) => {
    const { treeId, personId } = c.req.valid('param')
    const data = run(treeId, [{ type: 'updatePerson', id: personId, patch: { photo: '' } }])
    return c.json(findPerson(data, personId), 200)
  })

  r.openapi(addLink, (c) => {
    const { treeId } = c.req.valid('param')
    const input = c.req.valid('json')
    const id = input.id ?? newId()
    const data = run(treeId, [{ type: 'addParentLink', link: { ...input, id } }])
    return c.json(find(data.parentLinks, id, 'Parent link'), 201)
  })

  r.openapi(updateLink, (c) => {
    const { treeId, linkId } = c.req.valid('param')
    const data = run(treeId, [
      { type: 'updateParentLink', id: linkId, kind: c.req.valid('json').kind },
    ])
    return c.json(find(data.parentLinks, linkId, 'Parent link'), 200)
  })

  r.openapi(deleteLink, (c) => {
    const { treeId, linkId } = c.req.valid('param')
    run(treeId, [{ type: 'removeParentLink', id: linkId }])
    return c.body(null, 204)
  })

  r.openapi(addPartnership, (c) => {
    const { treeId } = c.req.valid('param')
    const input = c.req.valid('json')
    const id = input.id ?? newId()
    const data = run(treeId, [{ type: 'addPartnership', partnership: { ...input, id } }])
    return c.json(find(data.partnerships, id, 'Partnership'), 201)
  })

  r.openapi(updatePartnership, (c) => {
    const { treeId, partnershipId } = c.req.valid('param')
    const data = run(treeId, [
      { type: 'updatePartnership', id: partnershipId, patch: c.req.valid('json') },
    ])
    return c.json(find(data.partnerships, partnershipId, 'Partnership'), 200)
  })

  r.openapi(deletePartnership, (c) => {
    const { treeId, partnershipId } = c.req.valid('param')
    run(treeId, [{ type: 'removePartnership', id: partnershipId }])
    return c.body(null, 204)
  })

  return r
}
