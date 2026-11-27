/* CreateSkillModal — merge accepted conventions into one skill (type
   `convention`, source `extracted`). Name, description, body and the set of
   included conventions are editable; picking a subset lets the user split the
   accepted conventions into several skills. Nothing is saved until Create. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Checkbox, FormField, Modal, TextInput, Toggle } from "@devdigest/ui";
import type { ConventionCandidate, Skill } from "@devdigest/shared";
import { useCreateConventionSkill } from "@/lib/hooks/conventions";
import { useSkillTokenCount } from "@/lib/hooks/skills";
import { renderSkillBlock, skillFilename } from "@/lib/skills";
import { BodyEditor } from "@/app/skills/_components/BodyEditor";
import { DEFAULT_SKILL_NAME, MODAL_WIDTH } from "./constants";
import { buildSkillBody, isSlug } from "./helpers";
import { s } from "./styles";

export interface CreateSkillModalProps {
  repoId: string;
  repoName: string;
  /** Accepted conventions only — the caller filters. */
  accepted: ConventionCandidate[];
  onClose: () => void;
  onCreated: (skill: Skill) => void;
}

export function CreateSkillModal({ repoId, repoName, accepted, onClose, onCreated }: CreateSkillModalProps) {
  const t = useTranslations("conventions.modal");
  const create = useCreateConventionSkill(repoId);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(accepted.map((c) => c.id)));
  const [name, setName] = React.useState(DEFAULT_SKILL_NAME);
  const [enabled, setEnabled] = React.useState(false);
  // Description and body follow the selection until the user edits them.
  const [description, setDescription] = React.useState<string | null>(null);
  const [body, setBody] = React.useState<string | null>(null);

  const chosen = accepted.filter((c) => selected.has(c.id));
  const effectiveDescription = description ?? t("defaultDescription", { count: chosen.length, repo: repoName });
  const effectiveBody = body ?? buildSkillBody(name, repoName, chosen);
  const { data: tokens } = useSkillTokenCount(
    renderSkillBlock({ name, description: effectiveDescription, body: effectiveBody }),
  );

  const nameOk = isSlug(name);
  const canSave =
    nameOk &&
    chosen.length > 0 &&
    effectiveDescription.trim() !== "" &&
    effectiveBody.trim() !== "" &&
    !create.isPending;

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const submit = () => {
    if (!canSave) return;
    create.mutate(
      {
        name,
        description: effectiveDescription.trim(),
        body: effectiveBody,
        enabled,
        convention_ids: chosen.map((c) => c.id),
      },
      { onSuccess: onCreated },
    );
  };

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("title")}
      subtitle={t("subtitle", { count: chosen.length, repo: repoName })}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button kind="primary" icon="Sparkles" onClick={submit} disabled={!canSave}>
            {create.isPending ? t("creating") : t("create")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <FormField label={t("include")} hint={t("includeHint")}>
          <div style={s.list}>
            {accepted.map((c) => (
              <Checkbox
                key={c.id}
                checked={selected.has(c.id)}
                onChange={(on) => toggle(c.id, on)}
                label={<span style={s.listItem}>{c.rule}</span>}
              />
            ))}
          </div>
          {chosen.length === 0 && (
            <div role="alert" style={s.error}>
              {t("noneSelected")}
            </div>
          )}
        </FormField>
        <FormField label={t("name")} required hint={nameOk ? t("nameHint") : undefined}>
          <TextInput aria-label={t("name")} value={name} onChange={(v) => setName(v.trim())} mono />
          {!nameOk && (
            <div role="alert" style={s.error}>
              {t("nameInvalid")}
            </div>
          )}
        </FormField>
        <FormField label={t("description")} required>
          <TextInput aria-label={t("description")} value={effectiveDescription} onChange={setDescription} />
        </FormField>
        <div style={s.row}>
          <FormField label={t("type")}>
            <TextInput aria-label={t("type")} value="convention" readOnly mono />
          </FormField>
          <FormField label={t("enabled")} hint={t("enabledHint")}>
            <span aria-label={t("enabled")} role="group">
              <Toggle on={enabled} onChange={setEnabled} />
            </span>
          </FormField>
        </div>
        <FormField label={t("body")} required>
          <BodyEditor
            ariaLabel={t("body")}
            value={effectiveBody}
            onChange={setBody}
            filename={skillFilename(name)}
            dirty
            tokens={tokens}
          />
        </FormField>
        {create.isError && (
          <div role="alert" style={s.error}>
            {t("failed", { message: create.error.message })}
          </div>
        )}
      </div>
    </Modal>
  );
}
