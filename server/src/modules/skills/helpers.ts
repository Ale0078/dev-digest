import { renderSkillBlock } from '@devdigest/reviewer-core';
import type { Skill, SkillVersion } from '@devdigest/shared';
import type {
  SkillContent,
  SkillRecord,
  SkillUsageCounts,
  SkillVersionRecord,
} from './types.js';

/** Pure helpers for the skills module (domain ring: no I/O). */

export const STATS_WINDOW_DAYS = 30;

export const EMPTY_USAGE: SkillUsageCounts = {
  agentCount: 0,
  pulledRuns: 0,
  linkedRuns: 0,
  accepted: 0,
  dismissed: 0,
};

/** Start of the stats window ending at `now`. */
export function statsSince(now: Date, days = STATS_WINDOW_DAYS): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** num ÷ den as a 0..1 fraction; null when there is no data. */
export function rate(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

export function pullRate(c: SkillUsageCounts): number | null {
  return rate(c.pulledRuns, c.linkedRuns);
}

export function acceptRate(c: SkillUsageCounts): number | null {
  return rate(c.accepted, c.accepted + c.dismissed);
}

/** True iff the patch changes a versioned field (name/description/type/body). */
export function isContentChange(current: SkillContent, patch: Partial<SkillContent>): boolean {
  return (
    (patch.name !== undefined && patch.name !== current.name) ||
    (patch.description !== undefined && patch.description !== current.description) ||
    (patch.type !== undefined && patch.type !== current.type) ||
    (patch.body !== undefined && patch.body !== current.body)
  );
}

/** Content of a snapshot; null fields (pre-M2 rows) fall back to the current values. */
export function snapshotContent(v: SkillVersionRecord, current: SkillContent): SkillContent {
  return {
    name: v.name ?? current.name,
    description: v.description ?? current.description,
    type: v.type ?? current.type,
    body: v.body,
  };
}

export function restoreMessage(version: number): string {
  return `Restored v${version}`;
}

/** The exact block the reviewing agent receives (shared with the trace). */
export function skillBlock(s: SkillContent): string {
  return renderSkillBlock({ name: s.name, description: s.description, body: s.body });
}

export function toSkillDto(r: SkillRecord, usage: SkillUsageCounts, bodyTokens: number): Skill {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type,
    source: r.source,
    body: r.body,
    enabled: r.enabled,
    version: r.version,
    evidence_files: r.evidenceFiles,
    agent_count: usage.agentCount,
    body_tokens: bodyTokens,
    updated_at: r.updatedAt.toISOString(),
    stats: { pull_rate: pullRate(usage), accept_rate: acceptRate(usage) },
  };
}

export function toSkillVersionDto(v: SkillVersionRecord): SkillVersion {
  return {
    skill_id: v.skillId,
    version: v.version,
    name: v.name,
    description: v.description,
    type: v.type,
    body: v.body,
    message: v.message,
    created_at: v.createdAt.toISOString(),
  };
}
