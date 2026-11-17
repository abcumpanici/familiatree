import { emptyTree } from '@familytree/domain'
import { fromGedcom, toGedcom } from '@familytree/domain/gedcom'
import { fromExportFile, toExportFile } from '@familytree/domain/schema'
import { createRoute, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import type { Config } from '../config.ts'
import type { Db } from '../db/index.ts'
import { trees } from '../db/schema.ts'
import { ApiError } from '../errors.ts'
import {
  countTrees,
  insertTreeData,
  listTrees,
  loadTreeData,
  requireTree,
  runCommands,
  withEmbeddedPhotos,
} from '../store.ts'
import {
  body,
  CommandSchema,
  ExportFileSchema,
  json,
  router,
  TreeDataSchema,
  TreeParams,
  TreeSchema,
  TreeSummarySchema,
  treeErrors,
} from './common.ts'

const tags = ['Trees']

const list = createRoute({
  method: 'get',
  path: '/api/trees',
  tags,
  summary: 'List all trees',
  responses: { 200: json(z.array(TreeSummarySchema)), ...treeErrors },
})

const create = createRoute({
  method: 'post',
  path: '/api/trees',
  tags,
  summary: 'Create an empty tree',
  request: body(z.object({ name: z.string().trim().min(1).max(120) })),
  responses: { 201: json(TreeSchema, 'The new tree'), ...treeErrors },
})

const importJson = createRoute({
  method: 'post',
  path: '/api/trees/import',
  tags,
  summary: 'Create a tree from an export file',
  description:
    'Takes the JSON file from GET /api/trees/{treeId}/export. The new tree gets new ids.',
  request: body(ExportFileSchema),
  responses: { 201: json(TreeDataSchema, 'The new tree'), ...treeErrors },
})

const importGedcom = createRoute({
  method: 'post',
  path: '/api/trees/import/gedcom',
  tags,
  summary: 'Create a tree from a GEDCOM file',
  request: {
    query: z.object({ name: z.string().max(120).optional() }),
    body: { required: true, content: { 'text/plain': { schema: z.string() } } },
  },
  responses: {
    201: json(
      z.object({ data: TreeDataSchema, warnings: z.array(z.string()) }),
      'The new tree, and lines that could not be imported',
    ),
    ...treeErrors,
  },
})

const get = createRoute({
  method: 'get',
  path: '/api/trees/{treeId}',
  tags,
  summary: 'Get a whole tree',
  description: 'The tree with all persons, parent links and partnerships.',
  request: { params: TreeParams },
  responses: { 200: json(TreeDataSchema), ...treeErrors },
})

const patch = createRoute({
  method: 'patch',
  path: '/api/trees/{treeId}',
  tags,
  summary: 'Rename a tree or change its Home person',
  request: {
    params: TreeParams,
    ...body(
      z.object({
        name: z.string().trim().min(1).max(120).optional(),
        homePersonId: z.string().nullable().optional(),
      }),
    ),
  },
  responses: { 200: json(TreeSchema), ...treeErrors },
})

const remove = createRoute({
  method: 'delete',
  path: '/api/trees/{treeId}',
  tags,
  summary: 'Delete a tree and everything in it',
  request: { params: TreeParams },
  responses: { 204: { description: 'Deleted' }, ...treeErrors },
})

const commands = createRoute({
  method: 'post',
  path: '/api/trees/{treeId}/commands',
  tags,
  summary: 'Apply many changes at once',
  description:
    'Runs the commands in order in one transaction. If one fails, nothing is saved. Returns the whole tree after the changes.',
  request: {
    params: TreeParams,
    ...body(z.object({ commands: z.array(CommandSchema).min(1).max(500) })),
  },
  responses: { 200: json(z.object({ data: TreeDataSchema })), ...treeErrors },
})

const exportJson = createRoute({
  method: 'get',
  path: '/api/trees/{treeId}/export',
  tags,
  summary: 'Download the full tree as a JSON export file',
  description: 'Photos are included as data URLs. Use POST /api/trees/import to load it again.',
  request: { params: TreeParams },
  responses: { 200: json(ExportFileSchema), ...treeErrors },
})

const exportGedcom = createRoute({
  method: 'get',
  path: '/api/trees/{treeId}/export.ged',
  tags,
  summary: 'Download the tree as GEDCOM 5.5.1',
  request: { params: TreeParams },
  responses: {
    200: { description: 'GEDCOM text', content: { 'text/plain': { schema: z.string() } } },
    ...treeErrors,
  },
})

function fileName(name: string, ext: string) {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'family-tree'
  return `attachment; filename="${slug}.${ext}"`
}

export function treeRoutes(db: Db, config: Config) {
  const r = router()

  const checkTreeLimit = () => {
    if (countTrees(db) >= config.maxTrees) {
      throw new ApiError(403, 'limit', `This server can hold at most ${config.maxTrees} trees`)
    }
  }

  r.openapi(list, (c) => c.json(listTrees(db), 200))

  r.openapi(create, (c) => {
    checkTreeLimit()
    const data = emptyTree({ name: c.req.valid('json').name })
    return c.json(insertTreeData(db, data).tree, 201)
  })

  r.openapi(importJson, (c) => {
    checkTreeLimit()
    const data = fromExportFile(c.req.valid('json'), { maxPeople: config.maxPeoplePerTree })
    return c.json(insertTreeData(db, data), 201)
  })

  r.openapi(importGedcom, async (c) => {
    checkTreeLimit()
    const text = await c.req.text()
    if (!text.trim()) throw new ApiError(400, 'invalid', 'The GEDCOM file is empty')
    const { name } = c.req.valid('query')
    const result = fromGedcom(text, {
      ...(name ? { name } : {}),
      maxPeople: config.maxPeoplePerTree,
    })
    if (result.data.people.length === 0) {
      throw new ApiError(400, 'invalid', 'No persons were found in the GEDCOM file')
    }
    return c.json({ data: insertTreeData(db, result.data), warnings: result.warnings }, 201)
  })

  r.openapi(get, (c) => c.json(loadTreeData(db, c.req.valid('param').treeId), 200))

  r.openapi(patch, (c) => {
    const { treeId } = c.req.valid('param')
    const patchBody = c.req.valid('json')
    const data = runCommands(db, config, treeId, [
      {
        type: 'updateTree',
        patch: {
          ...(patchBody.name !== undefined ? { name: patchBody.name } : {}),
          ...(patchBody.homePersonId !== undefined ? { homePersonId: patchBody.homePersonId } : {}),
        },
      },
    ])
    return c.json(data.tree, 200)
  })

  r.openapi(remove, (c) => {
    const { treeId } = c.req.valid('param')
    requireTree(db, treeId)
    db.delete(trees).where(eq(trees.id, treeId)).run()
    return c.body(null, 204)
  })

  r.openapi(commands, (c) => {
    const { treeId } = c.req.valid('param')
    const data = runCommands(db, config, treeId, c.req.valid('json').commands)
    return c.json({ data }, 200)
  })

  r.openapi(exportJson, (c) => {
    const data = loadTreeData(db, c.req.valid('param').treeId)
    c.header('Content-Disposition', fileName(data.tree.name, 'familytree.json'))
    return c.json(toExportFile(withEmbeddedPhotos(db, data)), 200)
  })

  r.openapi(exportGedcom, (c) => {
    const data = loadTreeData(db, c.req.valid('param').treeId)
    c.header('Content-Disposition', fileName(data.tree.name, 'ged'))
    return c.text(toGedcom(data), 200)
  })

  return r
}
