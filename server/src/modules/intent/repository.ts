import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { IntentPull, IntentStore, NewIntent, StoredIntent } from './types.js';

type IntentRow = typeof t.prIntent.$inferSelect;

function toStored(row: IntentRow): StoredIntent {
  return {
    prId: row.prId,
    summary: row.intent,
    inScope: row.inScope,
    outOfScope: row.outOfScope,
    riskAreas: row.riskAreas,
    confidence: row.confidence as StoredIntent['confidence'],
    missingContext: row.missingContext,
    sources: row.sources,
    headSha: row.headSha,
    provider: row.provider,
    model: row.model,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    costUsd: row.costUsd,
    updatedAt: row.updatedAt,
  };
}

/** Drizzle implementation of `IntentStore`. The PR lookup is workspace-scoped. */
export class IntentRepository implements IntentStore {
  constructor(private db: Db) {}

  async getPull(workspaceId: string, prId: string): Promise<IntentPull | undefined> {
    const [row] = await this.db
      .select({ pr: t.pullRequests, repo: t.repos })
      .from(t.pullRequests)
      .innerJoin(t.repos, eq(t.repos.id, t.pullRequests.repoId))
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
    if (!row) return undefined;
    return {
      id: row.pr.id,
      number: row.pr.number,
      title: row.pr.title,
      author: row.pr.author,
      body: row.pr.body,
      headSha: row.pr.headSha,
      repo: {
        id: row.repo.id,
        owner: row.repo.owner,
        name: row.repo.name,
        clonePath: row.repo.clonePath,
      },
    };
  }

  async get(prId: string): Promise<StoredIntent | undefined> {
    const [row] = await this.db.select().from(t.prIntent).where(eq(t.prIntent.prId, prId));
    return row ? toStored(row) : undefined;
  }

  async upsert(prId: string, i: NewIntent): Promise<StoredIntent> {
    const values = {
      intent: i.summary,
      inScope: i.inScope,
      outOfScope: i.outOfScope,
      riskAreas: i.riskAreas,
      confidence: i.confidence,
      missingContext: i.missingContext,
      sources: i.sources,
      headSha: i.headSha,
      provider: i.provider,
      model: i.model,
      tokensIn: i.tokensIn,
      tokensOut: i.tokensOut,
      costUsd: i.costUsd,
    };
    const [row] = await this.db
      .insert(t.prIntent)
      .values({ prId, ...values })
      .onConflictDoUpdate({ target: t.prIntent.prId, set: { ...values, updatedAt: new Date() } })
      .returning();
    return toStored(row!);
  }
}
