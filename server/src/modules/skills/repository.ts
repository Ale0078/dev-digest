import { and, asc, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import { EMPTY_USAGE, isContentChange } from './helpers.js';
import type {
  NewSkill,
  SkillEdit,
  SkillEditOptions,
  SkillRecord,
  SkillStatsCounts,
  SkillsStore,
  SkillUsageCounts,
  SkillVersionRecord,
} from './types.js';

/**
 * Skills data access (Drizzle). Owns `skills` + `skill_versions` and reads
 * `agent_skills`, `agent_runs`, `run_skills`, `reviews`, `findings` for stats.
 * Rows are mapped to records here and never leave this file.
 */

type SkillRow = typeof t.skills.$inferSelect;
type SkillVersionRow = typeof t.skillVersions.$inferSelect;

/** Runs counted by stats: local + ci (the only sources today, kept explicit). */
const STATS_SOURCES = ['local', 'ci'] as const;

const toRecord = (r: SkillRow): SkillRecord => ({
  id: r.id,
  name: r.name,
  description: r.description,
  type: r.type,
  source: r.source,
  body: r.body,
  enabled: r.enabled,
  version: r.version,
  evidenceFiles: r.evidenceFiles ?? null,
  updatedAt: r.updatedAt,
});

const toVersionRecord = (r: SkillVersionRow): SkillVersionRecord => ({
  skillId: r.skillId,
  version: r.version,
  name: r.name,
  description: r.description,
  type: r.type,
  body: r.body,
  message: r.message,
  createdAt: r.createdAt,
});

const countInt = (expr: SQL) => sql<number>`(${expr})::int`;

export class SkillsRepository implements SkillsStore {
  constructor(private db: Db) {}

  async list(workspaceId: string): Promise<SkillRecord[]> {
    const rows = await this.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(desc(t.skills.updatedAt), asc(t.skills.name));
    return rows.map(toRecord);
  }

  async get(workspaceId: string, id: string): Promise<SkillRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row ? toRecord(row) : undefined;
  }

  async create(workspaceId: string, input: NewSkill): Promise<SkillRecord> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(t.skills)
        .values({
          workspaceId,
          name: input.name,
          description: input.description,
          type: input.type,
          source: input.source,
          body: input.body,
          enabled: input.enabled,
          version: 1,
        })
        .returning();
      await tx.insert(t.skillVersions).values({
        skillId: row!.id,
        version: 1,
        name: row!.name,
        description: row!.description,
        type: row!.type,
        body: row!.body,
        message: input.message,
      });
      return toRecord(row!);
    });
  }

  async edit(
    workspaceId: string,
    id: string,
    patch: SkillEdit,
    opts: SkillEditOptions,
  ): Promise<SkillRecord | undefined> {
    return this.db.transaction(async (tx) => {
      // Row lock: concurrent edits serialise, so two saves can't both claim vN+1.
      const [current] = await tx
        .select()
        .from(t.skills)
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .for('update');
      if (!current) return undefined;

      const bump = opts.forceVersion === true || isContentChange(current, patch);
      // A note without a content change annotates the CURRENT version (no new vN).
      if (!bump && opts.message) {
        await tx
          .update(t.skillVersions)
          .set({ message: opts.message })
          .where(and(eq(t.skillVersions.skillId, id), eq(t.skillVersions.version, current.version)));
      }
      const touch = bump || patch.enabled !== undefined;
      if (!touch) return toRecord(current);

      const [row] = await tx
        .update(t.skills)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.body !== undefined ? { body: patch.body } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(bump ? { version: current.version + 1 } : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(t.skills.id, id))
        .returning();

      if (bump) {
        await tx.insert(t.skillVersions).values({
          skillId: id,
          version: row!.version,
          name: row!.name,
          description: row!.description,
          type: row!.type,
          body: row!.body,
          message: opts.message,
        });
      }
      return toRecord(row!);
    });
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  async listVersions(skillId: string): Promise<SkillVersionRecord[]> {
    const rows = await this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
    return rows.map(toVersionRecord);
  }

  async getVersion(skillId: string, version: number): Promise<SkillVersionRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skillVersions)
      .where(and(eq(t.skillVersions.skillId, skillId), eq(t.skillVersions.version, version)));
    return row ? toVersionRecord(row) : undefined;
  }

  // ---- stats -------------------------------------------------------------
  // Each query is grouped by skill id and scoped by `scope` (workspace, plus
  // optionally one skill), so the list endpoint costs 3 queries total.

  private async usage(scope: SQL, since: Date): Promise<Map<string, SkillUsageCounts>> {
    const inWindow = and(
      gte(t.agentRuns.ranAt, since),
      inArray(t.agentRuns.source, [...STATS_SOURCES]),
    );

    const [links, runs, verdicts] = await Promise.all([
      // Agents with an ENABLED link.
      this.db
        .select({ skillId: t.agentSkills.skillId, n: countInt(sql`count(*)`) })
        .from(t.agentSkills)
        .innerJoin(t.skills, eq(t.skills.id, t.agentSkills.skillId))
        .where(and(scope, eq(t.agentSkills.enabled, true)))
        .groupBy(t.agentSkills.skillId),
      // Done runs of currently linked agents (any link state), and how many of
      // them injected the skill (have a run_skills row).
      this.db
        .select({
          skillId: t.agentSkills.skillId,
          linked: countInt(sql`count(distinct ${t.agentRuns.id})`),
          pulled: countInt(
            sql`count(distinct ${t.agentRuns.id}) filter (where ${t.runSkills.runId} is not null)`,
          ),
        })
        .from(t.agentSkills)
        .innerJoin(t.skills, eq(t.skills.id, t.agentSkills.skillId))
        .innerJoin(t.agentRuns, eq(t.agentRuns.agentId, t.agentSkills.agentId))
        .leftJoin(
          t.runSkills,
          and(eq(t.runSkills.runId, t.agentRuns.id), eq(t.runSkills.skillId, t.agentSkills.skillId)),
        )
        .where(and(scope, inWindow, eq(t.agentRuns.status, 'done')))
        .groupBy(t.agentSkills.skillId),
      // Accepted / dismissed findings of runs that injected the skill.
      this.db
        .select({
          skillId: t.runSkills.skillId,
          accepted: countInt(sql`count(*) filter (where ${t.findings.acceptedAt} is not null)`),
          dismissed: countInt(sql`count(*) filter (where ${t.findings.dismissedAt} is not null)`),
        })
        .from(t.runSkills)
        .innerJoin(t.skills, eq(t.skills.id, t.runSkills.skillId))
        .innerJoin(t.agentRuns, eq(t.agentRuns.id, t.runSkills.runId))
        .innerJoin(t.reviews, eq(t.reviews.runId, t.runSkills.runId))
        .innerJoin(t.findings, eq(t.findings.reviewId, t.reviews.id))
        .where(and(scope, inWindow))
        .groupBy(t.runSkills.skillId),
    ]);

    const out = new Map<string, SkillUsageCounts>();
    const at = (id: string) => {
      let c = out.get(id);
      if (!c) out.set(id, (c = { ...EMPTY_USAGE }));
      return c;
    };
    for (const r of links) at(r.skillId).agentCount = r.n;
    for (const r of runs) Object.assign(at(r.skillId), { linkedRuns: r.linked, pulledRuns: r.pulled });
    for (const r of verdicts) Object.assign(at(r.skillId), { accepted: r.accepted, dismissed: r.dismissed });
    return out;
  }

  async usageByWorkspace(workspaceId: string, since: Date): Promise<Map<string, SkillUsageCounts>> {
    return this.usage(eq(t.skills.workspaceId, workspaceId), since);
  }

  async stats(workspaceId: string, skillId: string, since: Date): Promise<SkillStatsCounts> {
    const scope = and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, skillId))!;
    const [usage, agents, byCategory] = await Promise.all([
      this.usage(scope, since),
      this.db
        .select({ id: t.agents.id, name: t.agents.name })
        .from(t.agentSkills)
        .innerJoin(t.skills, eq(t.skills.id, t.agentSkills.skillId))
        .innerJoin(t.agents, eq(t.agents.id, t.agentSkills.agentId))
        .where(and(scope, eq(t.agentSkills.enabled, true)))
        .orderBy(asc(t.agents.name)),
      this.db
        .select({ category: t.findings.category, count: countInt(sql`count(*)`) })
        .from(t.runSkills)
        .innerJoin(t.skills, eq(t.skills.id, t.runSkills.skillId))
        .innerJoin(t.agentRuns, eq(t.agentRuns.id, t.runSkills.runId))
        .innerJoin(t.reviews, eq(t.reviews.runId, t.runSkills.runId))
        .innerJoin(t.findings, eq(t.findings.reviewId, t.reviews.id))
        .where(
          and(
            scope,
            gte(t.agentRuns.ranAt, since),
            inArray(t.agentRuns.source, [...STATS_SOURCES]),
          ),
        )
        .groupBy(t.findings.category)
        .orderBy(sql`count(*) desc`, asc(t.findings.category)),
    ]);
    return {
      ...(usage.get(skillId) ?? EMPTY_USAGE),
      findings: byCategory.reduce((n, c) => n + c.count, 0),
      agents,
      byCategory,
    };
  }
}
