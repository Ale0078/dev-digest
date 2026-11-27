import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type {
  ConventionPatch,
  ConventionRecord,
  ConventionsStore,
  NewConvention,
  RepoRef,
} from './types.js';

type ConventionRow = typeof t.conventions.$inferSelect;

function toRecord(row: ConventionRow): ConventionRecord {
  return {
    id: row.id,
    rule: row.rule,
    evidencePath: row.evidencePath ?? '',
    evidenceSnippet: row.evidenceSnippet ?? '',
    confidence: row.confidence ?? 0,
    accepted: row.accepted,
  };
}

/** Drizzle implementation of `ConventionsStore`. Every query is workspace + repo scoped. */
export class ConventionsRepository implements ConventionsStore {
  constructor(private db: Db) {}

  private scope(workspaceId: string, repoId: string) {
    return and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId));
  }

  async getRepo(workspaceId: string, repoId: string): Promise<RepoRef | undefined> {
    const [row] = await this.db
      .select({ id: t.repos.id, fullName: t.repos.fullName, clonePath: t.repos.clonePath })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row;
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionRecord[]> {
    const rows = await this.db
      .select()
      .from(t.conventions)
      .where(this.scope(workspaceId, repoId))
      .orderBy(desc(t.conventions.confidence), t.conventions.id);
    return rows.map(toRecord);
  }

  async update(
    workspaceId: string,
    repoId: string,
    id: string,
    patch: ConventionPatch,
  ): Promise<ConventionRecord | undefined> {
    const set: Partial<typeof t.conventions.$inferInsert> = {};
    if (patch.rule !== undefined) set.rule = patch.rule;
    if (patch.accepted !== undefined) set.accepted = patch.accepted;
    const where = and(this.scope(workspaceId, repoId), eq(t.conventions.id, id));
    if (Object.keys(set).length === 0) {
      const [row] = await this.db.select().from(t.conventions).where(where);
      return row ? toRecord(row) : undefined;
    }
    const [row] = await this.db.update(t.conventions).set(set).where(where).returning();
    return row ? toRecord(row) : undefined;
  }

  async delete(workspaceId: string, repoId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.conventions)
      .where(and(this.scope(workspaceId, repoId), eq(t.conventions.id, id)))
      .returning({ id: t.conventions.id });
    return rows.length > 0;
  }

  async replacePending(workspaceId: string, repoId: string, rows: NewConvention[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(t.conventions)
        .where(and(this.scope(workspaceId, repoId), eq(t.conventions.accepted, false)));
      if (rows.length === 0) return;
      await tx.insert(t.conventions).values(
        rows.map((r) => ({
          workspaceId,
          repoId,
          rule: r.rule,
          evidencePath: r.evidencePath,
          evidenceSnippet: r.evidenceSnippet,
          confidence: r.confidence,
          accepted: false,
        })),
      );
    });
  }
}
