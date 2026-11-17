import { blob, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const trees = sqliteTable('trees', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  homePersonId: text('home_person_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const people = sqliteTable(
  'people',
  {
    id: text('id').notNull(),
    treeId: text('tree_id')
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    firstNames: text('first_names').notNull(),
    surname: text('surname').notNull(),
    birthSurname: text('birth_surname').notNull(),
    gender: text('gender').notNull(),
    bornDate: text('born_date').notNull(),
    bornPlace: text('born_place').notNull(),
    died: integer('died', { mode: 'boolean' }).notNull(),
    diedDate: text('died_date').notNull(),
    diedPlace: text('died_place').notNull(),
    photo: text('photo').notNull(),
    story: text('story').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('people_pk').on(t.treeId, t.id)],
)

export const parentLinks = sqliteTable(
  'parent_links',
  {
    id: text('id').notNull(),
    treeId: text('tree_id')
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    childId: text('child_id').notNull(),
    parentId: text('parent_id').notNull(),
    kind: text('kind').notNull(),
  },
  (t) => [uniqueIndex('parent_links_pk').on(t.treeId, t.id)],
)

export const partnerships = sqliteTable(
  'partnerships',
  {
    id: text('id').notNull(),
    treeId: text('tree_id')
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    personAId: text('person_a_id').notNull(),
    personBId: text('person_b_id').notNull(),
    married: integer('married', { mode: 'boolean' }).notNull(),
    startDate: text('start_date').notNull(),
    startPlace: text('start_place').notNull(),
    ended: integer('ended', { mode: 'boolean' }).notNull(),
    endDate: text('end_date').notNull(),
    endPlace: text('end_place').notNull(),
  },
  (t) => [uniqueIndex('partnerships_pk').on(t.treeId, t.id)],
)

export const photos = sqliteTable(
  'photos',
  {
    treeId: text('tree_id')
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    personId: text('person_id').notNull(),
    contentType: text('content_type').notNull(),
    hash: text('hash').notNull(),
    bytes: blob('bytes', { mode: 'buffer' }).notNull(),
  },
  (t) => [uniqueIndex('photos_pk').on(t.treeId, t.personId)],
)
