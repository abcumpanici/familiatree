import { PARENT_KINDS } from '@familytree/domain'
import {
  ExportFileSchema,
  ParentLinkSchema,
  PartnershipFieldsSchema,
  PartnershipPatchSchema,
  PartnershipSchema,
  PersonInputSchema,
  PersonPatchSchema,
  PersonSchema,
  TreeDataSchema,
  TreeSchema,
} from '@familytree/domain/schema'
import { OpenAPIHono, z } from '@hono/zod-openapi'
import { errorBody, zodMessage } from '../errors.ts'

export function router() {
  return new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) return c.json(errorBody('invalid', zodMessage(result.error)), 400)
    },
  })
}

export const ErrorSchema = z
  .object({ error: z.object({ code: z.string(), message: z.string() }) })
  .meta({ id: 'Error' })

export const TreeSummarySchema = TreeSchema.extend({ peopleCount: z.number().int() }).meta({
  id: 'TreeSummary',
})

const idParam = (name: string) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/)
    .openapi({ param: { name, in: 'path' } })

export const TreeParams = z.object({ treeId: idParam('treeId') })
export const PersonParams = TreeParams.extend({ personId: idParam('personId') })
export const LinkParams = TreeParams.extend({ linkId: idParam('linkId') })
export const PartnershipParams = TreeParams.extend({ partnershipId: idParam('partnershipId') })

export const ParentLinkInputSchema = z
  .object({
    id: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .optional(),
    childId: z.string(),
    parentId: z.string(),
    kind: z.enum(PARENT_KINDS).optional().meta({ description: 'Defaults to birth' }),
  })
  .meta({ id: 'ParentLinkInput' })

export const PartnershipInputSchema = PartnershipFieldsSchema.partial()
  .extend({
    id: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .optional(),
    personAId: z.string(),
    personBId: z.string(),
  })
  .meta({ id: 'PartnershipInput' })

const id = z.string()

export const CommandSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('addPerson'), person: PersonInputSchema }),
    z.object({ type: z.literal('updatePerson'), id, patch: PersonPatchSchema }),
    z.object({ type: z.literal('deletePerson'), id }),
    z.object({ type: z.literal('addParentLink'), link: ParentLinkInputSchema }),
    z.object({ type: z.literal('updateParentLink'), id, kind: z.enum(PARENT_KINDS) }),
    z.object({ type: z.literal('removeParentLink'), id }),
    z.object({ type: z.literal('addPartnership'), partnership: PartnershipInputSchema }),
    z.object({ type: z.literal('updatePartnership'), id, patch: PartnershipPatchSchema }),
    z.object({ type: z.literal('removePartnership'), id }),
    z.object({
      type: z.literal('updateTree'),
      patch: z.object({
        name: z.string().optional(),
        homePersonId: z.string().nullable().optional(),
      }),
    }),
  ])
  .meta({
    id: 'Command',
    description:
      'One change to a tree. Send many in one /commands call; they run in order, all or nothing. Give your own ids (letters, digits, - or _) to refer to new persons in later commands of the same batch.',
  })

export const RelativesSchema = z
  .object({
    person: PersonSchema,
    parents: z.array(z.object({ link: ParentLinkSchema, person: PersonSchema })),
    children: z.array(z.object({ link: ParentLinkSchema, person: PersonSchema })),
    partners: z.array(z.object({ partnership: PartnershipSchema, person: PersonSchema })),
    siblings: z.array(PersonSchema),
  })
  .meta({ id: 'Relatives' })

export {
  ExportFileSchema,
  ParentLinkSchema,
  PartnershipPatchSchema,
  PartnershipSchema,
  PersonInputSchema,
  PersonPatchSchema,
  PersonSchema,
  TreeDataSchema,
  TreeSchema,
}

export function json<T>(schema: T, description = 'OK') {
  return { description, content: { 'application/json': { schema } } }
}

export function body<T>(schema: T, description?: string) {
  return {
    body: {
      required: true,
      ...(description ? { description } : {}),
      content: { 'application/json': { schema } },
    },
  }
}

export const err = (description: string) => json(ErrorSchema, description)

export const treeErrors = {
  400: err('The input is not valid'),
  404: err('The tree, person or link was not found'),
  409: err('The change breaks a tree rule (duplicate, cycle, more than 2 birth parents)'),
  403: err('A limit was reached'),
}
