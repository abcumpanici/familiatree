import { z } from 'zod'
import { applyCommand, emptyTree, LIMITS, newId } from './ops.ts'
import { GENDERS, type Id, PARENT_KINDS, type TreeData } from './types.ts'

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
const date = z.string().max(40).meta({
  description:
    'A full or partial date. Stored as "1952-03-14", "1952-03", "1952" or "~1900" (about). Input also accepts "14 March 1952", "14/03/1952", "about 1900".',
  example: '1952-03-14',
})

export const PersonFieldsSchema = z.object({
  firstNames: z.string().min(1).max(LIMITS.name).meta({ example: 'Maria Elena' }),
  surname: z.string().max(LIMITS.name).meta({ example: 'Popa' }),
  birthSurname: z
    .string()
    .max(LIMITS.name)
    .meta({ description: 'Surname at birth, if different', example: 'Ionescu' }),
  gender: z.enum(GENDERS),
  bornDate: date,
  bornPlace: z.string().max(LIMITS.place),
  died: z.boolean().meta({ description: 'True if the person is dead, with or without a date' }),
  diedDate: date,
  diedPlace: z.string().max(LIMITS.place),
  photo: z.string().max(LIMITS.photo).meta({ description: 'Photo URL or data URL' }),
  story: z
    .string()
    .max(LIMITS.story)
    .meta({ description: 'Markdown: achievements, memories, anything interesting' }),
})

export const PersonSchema = PersonFieldsSchema.extend({
  id,
  createdAt: z.string(),
  updatedAt: z.string(),
}).meta({ id: 'Person' })

export const PersonInputSchema = PersonFieldsSchema.partial()
  .extend({ id: id.optional(), firstNames: z.string().min(1).max(LIMITS.name) })
  .meta({ id: 'PersonInput' })

export const PersonPatchSchema = PersonFieldsSchema.partial().meta({ id: 'PersonPatch' })

export const ParentLinkSchema = z
  .object({ id, childId: id, parentId: id, kind: z.enum(PARENT_KINDS) })
  .meta({ id: 'ParentLink' })

export const PartnershipFieldsSchema = z.object({
  married: z.boolean(),
  startDate: date.meta({ description: 'For example the wedding date' }),
  startPlace: z.string().max(LIMITS.place),
  ended: z.boolean().meta({ description: 'True if the partnership ended, for example a divorce' }),
  endDate: date,
  endPlace: z.string().max(LIMITS.place),
})

export const PartnershipSchema = PartnershipFieldsSchema.extend({
  id,
  personAId: id,
  personBId: id,
}).meta({ id: 'Partnership' })

export const PartnershipPatchSchema = PartnershipFieldsSchema.partial().meta({
  id: 'PartnershipPatch',
})

export const TreeSchema = z
  .object({
    id,
    name: z.string().max(LIMITS.treeName),
    homePersonId: id.nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .meta({ id: 'Tree' })

export const TreeDataSchema = z
  .object({
    tree: TreeSchema,
    people: z.array(PersonSchema),
    parentLinks: z.array(ParentLinkSchema),
    partnerships: z.array(PartnershipSchema),
  })
  .meta({ id: 'TreeData' })

export const EXPORT_FORMAT = 'familytree'
export const EXPORT_VERSION = 1

export const ExportFileSchema = TreeDataSchema.extend({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string(),
}).meta({ id: 'ExportFile' })

export type ExportFile = z.infer<typeof ExportFileSchema>

export function toExportFile(data: TreeData, now = new Date().toISOString()): ExportFile {
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now, ...data }
}

export interface ImportOptions {
  treeId?: Id
  maxPeople?: number
  keepIds?: boolean
}

export function fromExportFile(input: unknown, options: ImportOptions = {}): TreeData {
  const file = ExportFileSchema.parse(input)
  const remap = new Map<Id, Id>()
  const mapId = (old: Id) => {
    if (options.keepIds) return old
    let next = remap.get(old)
    if (!next) {
      next = newId()
      remap.set(old, next)
    }
    return next
  }
  let data = emptyTree({
    id: options.treeId ?? (options.keepIds ? file.tree.id : newId()),
    name: file.tree.name,
    now: file.tree.createdAt,
  })
  const limit = options.maxPeople === undefined ? {} : { maxPeople: options.maxPeople }
  for (const p of file.people) {
    const { id: oldId, createdAt, updatedAt, ...fields } = p
    data = applyCommand(
      data,
      { type: 'addPerson', person: { ...fields, id: mapId(oldId) } },
      { ...limit, now: createdAt },
    ).data
    const last = data.people[data.people.length - 1]
    if (last) last.updatedAt = updatedAt
  }
  for (const l of file.parentLinks) {
    data = applyCommand(data, {
      type: 'addParentLink',
      link: {
        id: mapId(l.id),
        childId: mapId(l.childId),
        parentId: mapId(l.parentId),
        kind: l.kind,
      },
    }).data
  }
  for (const p of file.partnerships) {
    const { id: oldId, personAId, personBId, ...fields } = p
    data = applyCommand(data, {
      type: 'addPartnership',
      partnership: {
        ...fields,
        id: mapId(oldId),
        personAId: mapId(personAId),
        personBId: mapId(personBId),
      },
    }).data
  }
  const home = file.tree.homePersonId
  data = {
    ...data,
    tree: {
      ...data.tree,
      homePersonId: home && data.people.length ? mapId(home) : (data.people[0]?.id ?? null),
      createdAt: file.tree.createdAt,
      updatedAt: file.tree.updatedAt,
    },
  }
  return data
}
