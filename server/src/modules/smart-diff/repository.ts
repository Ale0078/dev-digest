import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { ReviewFindingLines, SmartDiffFileRow, SmartDiffStore } from './types.js';

/** Drizzle implementation of `SmartDiffStore`. Read-only. */
export class SmartDiffRepository implements SmartDiffStore {
  constructor(private db: Db) {}

  async pullExists(workspaceId: string, prId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: t.pullRequests.id })
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
    return !!row;
  }

  async listFiles(prId: string): Promise<SmartDiffFileRow[]> {
    const rows = await this.db
      .select({ path: t.prFiles.path, additions: t.prFiles.additions, deletions: t.prFiles.deletions })
      .from(t.prFiles)
      .where(eq(t.prFiles.prId, prId));
    return rows;
  }

  async listReviewFindings(prId: string): Promise<ReviewFindingLines[]> {
    const reviews = await this.db
      .select({ id: t.reviews.id, agentId: t.reviews.agentId })
      .from(t.reviews)
      .where(and(eq(t.reviews.prId, prId), eq(t.reviews.kind, 'review')))
      .orderBy(desc(t.reviews.createdAt));
    if (reviews.length === 0) return [];
    const rows = await this.db
      .select({ reviewId: t.findings.reviewId, file: t.findings.file, startLine: t.findings.startLine })
      .from(t.findings)
      .where(
        inArray(
          t.findings.reviewId,
          reviews.map((r) => r.id),
        ),
      );
    return reviews.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      findings: rows
        .filter((f) => f.reviewId === r.id)
        .map((f) => ({ file: f.file, start_line: f.startLine })),
    }));
  }
}
