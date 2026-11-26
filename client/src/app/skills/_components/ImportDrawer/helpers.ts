import type { SkillImportPreview } from "@devdigest/shared";
import type { SkillDraft } from "../SkillConfigForm";

/** Editable part of an import preview. */
export function previewToDraft(p: SkillImportPreview): SkillDraft {
  return { name: p.name, description: p.description, type: p.type, body: p.body };
}
