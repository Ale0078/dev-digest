import type { AgentSkillLink, Skill } from "@devdigest/shared";

/** One row of the agent's Skills tab: a workspace skill + this agent's link flag. */
export interface SkillRow {
  skill_id: string;
  enabled: boolean;
}

/** Linked skills first (by link order), then every unlinked workspace skill, unchecked. */
export function buildRows(skills: Skill[], links: AgentSkillLink[]): SkillRow[] {
  const known = new Set(skills.map((sk) => sk.id));
  const linked = [...links]
    .filter((l) => known.has(l.skill_id))
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ skill_id: l.skill_id, enabled: l.enabled }));
  const linkedIds = new Set(linked.map((r) => r.skill_id));
  const unlinked = skills.filter((sk) => !linkedIds.has(sk.id)).map((sk) => ({ skill_id: sk.id, enabled: false }));
  return [...linked, ...unlinked];
}

/** Keep local edits but drop deleted skills and append skills created meanwhile. */
export function reconcileRows(rows: SkillRow[], skills: Skill[]): SkillRow[] {
  const known = new Set(skills.map((sk) => sk.id));
  const kept = rows.filter((r) => known.has(r.skill_id));
  const have = new Set(kept.map((r) => r.skill_id));
  return [...kept, ...skills.filter((sk) => !have.has(sk.id)).map((sk) => ({ skill_id: sk.id, enabled: false }))];
}

/** Move `fromId` to the position of `toId` (drag-and-drop drop target). */
export function moveRow(rows: SkillRow[], fromId: string, toId: string): SkillRow[] {
  if (fromId === toId) return rows;
  const from = rows.findIndex((r) => r.skill_id === fromId);
  const to = rows.findIndex((r) => r.skill_id === toId);
  if (from < 0 || to < 0) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  if (moved) next.splice(to, 0, moved);
  return next;
}

export function toggleRow(rows: SkillRow[], id: string): SkillRow[] {
  return rows.map((r) => (r.skill_id === id ? { ...r, enabled: !r.enabled } : r));
}

export function sameRows(a: SkillRow[], b: SkillRow[]): boolean {
  return a.length === b.length && a.every((r, i) => r.skill_id === b[i]?.skill_id && r.enabled === b[i]?.enabled);
}
