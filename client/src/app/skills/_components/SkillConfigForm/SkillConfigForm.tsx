/* SkillConfigForm — Name*, Description (directive hint), Type, Skill body* and
   the Enabled toggle; Save with an optional change note (→ version message).
   Controlled: the draft lives in the parent so Preview can render unsaved edits.
   Used by /skills/:id (edit) and /skills/new (create). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, SelectInput, TextInput, Toggle } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { useSkillTokenCount } from "../../../../lib/hooks/skills";
import { SKILL_TYPES, renderSkillBlock, skillFilename } from "../../../../lib/skills";
import { BodyEditor } from "../BodyEditor";
import { isDraftValid, type SkillDraft } from "./helpers";
import { s } from "./styles";

export function SkillConfigForm({
  mode,
  draft,
  onChange,
  dirty,
  enabled,
  onEnabledChange,
  saving,
  onSave,
}: {
  mode: "create" | "edit";
  draft: SkillDraft;
  onChange: (patch: Partial<SkillDraft>) => void;
  dirty: boolean;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  saving?: boolean;
  /** `onSaved` clears the change note once the save went through. */
  onSave: (note: string, onSaved: () => void) => void;
}) {
  const t = useTranslations("skills");
  const [note, setNote] = React.useState("");
  // Count the rendered block (what the prompt actually receives), like body_tokens.
  const { data: tokens } = useSkillTokenCount(renderSkillBlock(draft));
  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }));
  const valid = isDraftValid(draft);
  // A note alone is saveable too: it annotates the current version (no new vN).
  const canSave = valid && !saving && (mode === "create" || dirty || note.trim().length > 0);

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("config.title")}</h2>
        <label style={s.enabledLabel}>
          {t("config.enabled")}
          <Toggle on={enabled} onChange={onEnabledChange} size={16} />
        </label>
      </div>
      <FormField label={t("config.name")} required>
        <TextInput
          aria-label={t("config.name")}
          value={draft.name}
          onChange={(v) => onChange({ name: v })}
          placeholder={t("config.namePlaceholder")}
          mono
        />
      </FormField>
      <FormField label={t("config.description")} hint={t("config.descriptionHint")}>
        <TextInput
          aria-label={t("config.description")}
          value={draft.description}
          onChange={(v) => onChange({ description: v })}
          placeholder={t("config.descriptionPlaceholder")}
        />
      </FormField>
      <FormField label={t("config.type")}>
        <SelectInput value={draft.type} onChange={(v) => onChange({ type: v as SkillType })} options={typeOptions} />
      </FormField>
      <FormField label={t("config.body")} required>
        <BodyEditor
          ariaLabel={t("config.body")}
          value={draft.body}
          onChange={(v) => onChange({ body: v })}
          filename={skillFilename(draft.name)}
          dirty={dirty}
          tokens={tokens}
          placeholder={t("config.bodyPlaceholder")}
        />
      </FormField>
      {mode === "edit" && (
        <FormField label={t("config.changeNote")}>
          <TextInput
            aria-label={t("config.changeNote")}
            value={note}
            onChange={setNote}
            placeholder={t("config.changeNotePlaceholder")}
          />
        </FormField>
      )}
      <div style={s.actions}>
        <Button
          kind="primary"
          icon="Check"
          disabled={!canSave}
          onClick={() => onSave(note.trim(), () => setNote(""))}
        >
          {saving ? t("config.saving") : mode === "create" ? t("config.create") : t("config.save")}
        </Button>
        {!valid && <span style={s.invalid}>{t("config.required")}</span>}
      </div>
    </div>
  );
}
