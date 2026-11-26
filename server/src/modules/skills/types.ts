import type { SkillSource, SkillType } from '@devdigest/shared';

/**
 * Ports for the skills module. The service depends on these interfaces only;
 * `repository.ts` implements `SkillsStore` with Drizzle.
 */

/** The versioned content of a skill (what a `skill_versions` row snapshots). */
export interface SkillContent {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

/** A skill as stored, mapped out of the DB row at the repository boundary. */
export interface SkillRecord extends SkillContent {
  id: string;
  source: SkillSource;
  enabled: boolean;
  version: number;
  evidenceFiles: string[] | null;
  updatedAt: Date;
}

/** One snapshot. name/description/type/message are null on pre-M2 rows. */
export interface SkillVersionRecord {
  skillId: string;
  version: number;
  name: string | null;
  description: string | null;
  type: SkillType | null;
  body: string;
  message: string | null;
  createdAt: Date;
}

export interface NewSkill extends SkillContent {
  source: SkillSource;
  enabled: boolean;
  message: string | null;
}

export interface SkillEdit extends Partial<SkillContent> {
  enabled?: boolean;
}

export interface SkillEditOptions {
  message: string | null;
  /** Write a new version even if the content is unchanged (restore). */
  forceVersion?: boolean;
}

/**
 * Raw 30-day usage counts for one skill (rates are derived in the service).
 *  - pulledRuns / linkedRuns → pull_rate (done runs of currently linked agents
 *    that injected the skill ÷ all those runs)
 *  - accepted / dismissed   → accept_rate (findings of runs that injected it)
 */
export interface SkillUsageCounts {
  agentCount: number;
  pulledRuns: number;
  linkedRuns: number;
  accepted: number;
  dismissed: number;
}

export interface SkillStatsCounts extends SkillUsageCounts {
  findings: number;
  agents: { id: string; name: string }[];
  byCategory: { category: string; count: number }[];
}

export interface SkillsStore {
  /** Workspace skills, newest `updated_at` first. */
  list(workspaceId: string): Promise<SkillRecord[]>;
  get(workspaceId: string, id: string): Promise<SkillRecord | undefined>;
  /** Insert the skill at version 1 plus its v1 snapshot, atomically. */
  create(workspaceId: string, input: NewSkill): Promise<SkillRecord>;
  /**
   * Apply an edit atomically. A content change (or `forceVersion`) bumps the
   * version and writes a full snapshot; toggling `enabled` only touches
   * `updated_at`. undefined when the skill is not in the workspace.
   */
  edit(
    workspaceId: string,
    id: string,
    patch: SkillEdit,
    opts: SkillEditOptions,
  ): Promise<SkillRecord | undefined>;
  delete(workspaceId: string, id: string): Promise<boolean>;
  /** Newest version first. */
  listVersions(skillId: string): Promise<SkillVersionRecord[]>;
  getVersion(skillId: string, version: number): Promise<SkillVersionRecord | undefined>;
  /** Usage counts for every skill of the workspace (grouped queries, no N+1). */
  usageByWorkspace(workspaceId: string, since: Date): Promise<Map<string, SkillUsageCounts>>;
  /** Full Stats-tab counts for one skill. */
  stats(workspaceId: string, skillId: string, since: Date): Promise<SkillStatsCounts>;
}

/** Token counter port (structurally the platform tokenizer). */
export interface TokenCounter {
  count(text: string): number;
}
