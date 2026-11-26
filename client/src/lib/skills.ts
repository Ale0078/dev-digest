/** Skills domain helpers shared by /skills and the agent editor's Skills tab.
    Pure: no React, no IO. */
import type { SkillSource, SkillType } from "@devdigest/shared";

/** Selectable skill types, in display order. */
export const SKILL_TYPES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

export interface SkillBlockInput {
  name: string;
  description: string;
  body: string;
}

/**
 * Client mirror of reviewer-core's `renderSkillBlock` (reviewer-core/src/prompt.ts).
 * MUST stay byte-identical: the Preview tab claims to show the block "as the
 * reviewing agent receives it". Change both together (and both tests).
 */
export function renderSkillBlock(skill: SkillBlockInput): string {
  return `### ${skill.name}\n${skill.description}\n\n${skill.body}`;
}

/** Badge label key for a source: `imported` and legacy `imported_url` are both "Imported". */
export type SourceBadgeKey = "manual" | "imported" | "extracted" | "community";

export function sourceBadgeKey(source: SkillSource): SourceBadgeKey {
  return source === "imported_url" ? "imported" : source;
}

/** Imported skills carry someone else's instructions → show the trust banner. */
export function isImportedSource(source: SkillSource): boolean {
  return sourceBadgeKey(source) === "imported";
}

/** Fraction 0..1 → "42%"; null/undefined (no data) → "—". */
export function formatRate(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

/** `<name>.md` filename shown in the body editor header. */
export function skillFilename(name: string): string {
  const slug = name.trim();
  return `${slug || "untitled"}.md`;
}
