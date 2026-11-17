export type Id = string

export const GENDERS = ['male', 'female', 'other', 'unknown'] as const
export type Gender = (typeof GENDERS)[number]

export const PARENT_KINDS = ['birth', 'adopted', 'step', 'foster'] as const
export type ParentKind = (typeof PARENT_KINDS)[number]

export interface Tree {
  id: Id
  name: string
  homePersonId: Id | null
  createdAt: string
  updatedAt: string
}

export interface PersonFields {
  firstNames: string
  surname: string
  birthSurname: string
  gender: Gender
  bornDate: string
  bornPlace: string
  died: boolean
  diedDate: string
  diedPlace: string
  photo: string
  story: string
}

export interface Person extends PersonFields {
  id: Id
  createdAt: string
  updatedAt: string
}

export interface ParentLink {
  id: Id
  childId: Id
  parentId: Id
  kind: ParentKind
}

export interface PartnershipFields {
  married: boolean
  startDate: string
  startPlace: string
  ended: boolean
  endDate: string
  endPlace: string
}

export interface Partnership extends PartnershipFields {
  id: Id
  personAId: Id
  personBId: Id
}

export interface TreeData {
  tree: Tree
  people: Person[]
  parentLinks: ParentLink[]
  partnerships: Partnership[]
}

export type PersonInput = Partial<PersonFields> & { id?: Id; firstNames: string }
export type ParentLinkInput = { id?: Id; childId: Id; parentId: Id; kind?: ParentKind }
export type PartnershipInput = Partial<PartnershipFields> & {
  id?: Id
  personAId: Id
  personBId: Id
}

export type Command =
  | { type: 'addPerson'; person: PersonInput }
  | { type: 'updatePerson'; id: Id; patch: Partial<PersonFields> }
  | { type: 'deletePerson'; id: Id }
  | { type: 'addParentLink'; link: ParentLinkInput }
  | { type: 'updateParentLink'; id: Id; kind: ParentKind }
  | { type: 'removeParentLink'; id: Id }
  | { type: 'addPartnership'; partnership: PartnershipInput }
  | { type: 'updatePartnership'; id: Id; patch: Partial<PartnershipFields> }
  | { type: 'removePartnership'; id: Id }
  | { type: 'updateTree'; patch: { name?: string; homePersonId?: Id | null } }

export type Change =
  | { op: 'put'; entity: 'person'; value: Person }
  | { op: 'put'; entity: 'parentLink'; value: ParentLink }
  | { op: 'put'; entity: 'partnership'; value: Partnership }
  | { op: 'put'; entity: 'tree'; value: Tree }
  | { op: 'delete'; entity: 'person' | 'parentLink' | 'partnership'; id: Id }
