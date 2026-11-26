import { pgTable, uuid, text, integer, boolean, jsonb, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { now } from './_shared';
import { workspaces } from './core';

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: text('type', { enum: ['rubric', 'convention', 'security', 'custom'] }).notNull(),
  source: text('source', {
    enum: ['manual', 'imported', 'imported_url', 'extracted', 'community'],
  }).notNull(),
  body: text('body').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  version: integer('version').notNull().default(1),
  evidenceFiles: jsonb('evidence_files').$type<string[]>(),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const skillVersions = pgTable(
  'skill_versions',
  {
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    // Full snapshot since M2; nullable because pre-M2 rows only have `body`.
    name: text('name'),
    description: text('description'),
    type: text('type', { enum: ['rubric', 'convention', 'security', 'custom'] }),
    body: text('body').notNull(),
    message: text('message'),
    createdAt: now(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.skillId, t.version] }) }),
);
