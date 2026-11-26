import type { Skill, SkillType } from "@devdigest/shared";

/** The versioned content of a skill — what the Config form edits and Preview renders. */
export interface SkillDraft {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

export const EMPTY_DRAFT: SkillDraft = { name: "", description: "", type: "custom", body: "" };

export function draftFromSkill(skill: Pick<Skill, keyof SkillDraft>): SkillDraft {
  return { name: skill.name, description: skill.description, type: skill.type, body: skill.body };
}

/** Only the fields that differ from the saved skill (a PUT patch). */
export function draftChanges(draft: SkillDraft, saved: SkillDraft): Partial<SkillDraft> {
  const out: Partial<SkillDraft> = {};
  (Object.keys(draft) as (keyof SkillDraft)[]).forEach((k) => {
    if (draft[k] !== saved[k]) (out as Record<string, string>)[k] = draft[k];
  });
  return out;
}

export function isDraftDirty(draft: SkillDraft, saved: SkillDraft): boolean {
  return Object.keys(draftChanges(draft, saved)).length > 0;
}

/** Name and body are required (description may be empty). */
export function isDraftValid(draft: SkillDraft): boolean {
  return draft.name.trim().length > 0 && draft.body.trim().length > 0;
}
