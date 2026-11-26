/* ImportDrawer — drop/pick a .md or .zip → server parses it (writes nothing) →
   editable preview with ignored files, warnings and the trust banner → Save
   creates the skill as `source: 'imported'`, disabled. Cancel discards: nothing
   was persisted before Save. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Drawer, FormField, Icon, SelectInput, TextInput } from "@devdigest/ui";
import type { Skill, SkillImportPreview, SkillType } from "@devdigest/shared";
import { useCreateSkill, useImportSkillPreview, useSkillTokenCount } from "../../../../lib/hooks/skills";
import { SKILL_TYPES, renderSkillBlock, skillFilename } from "../../../../lib/skills";
import { BodyEditor } from "../BodyEditor";
import { TrustBanner } from "../TrustBanner";
import type { SkillDraft } from "../SkillConfigForm";
import { ACCEPT, DRAWER_WIDTH } from "./constants";
import { previewToDraft } from "./helpers";
import { s } from "./styles";

export function ImportDrawer({ onClose, onImported }: { onClose: () => void; onImported: (skill: Skill) => void }) {
  const t = useTranslations("skills");
  const parse = useImportSkillPreview();
  const create = useCreateSkill();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<SkillImportPreview | null>(null);
  const [draft, setDraft] = React.useState<SkillDraft | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const { data: tokens } = useSkillTokenCount(draft ? renderSkillBlock(draft) : "");

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    parse.mutate(file, {
      onSuccess: (p) => {
        setPreview(p);
        setDraft(previewToDraft(p));
      },
    });
  };

  const reset = () => {
    setPreview(null);
    setDraft(null);
    parse.reset();
  };

  const save = () => {
    if (!draft) return;
    create.mutate({ ...draft, source: "imported", enabled: false }, { onSuccess: onImported });
  };

  const patch = (p: Partial<SkillDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }));
  const canSave = !!draft && draft.name.trim() !== "" && draft.body.trim() !== "" && !create.isPending;

  return (
    <Drawer
      width={DRAWER_WIDTH}
      title={t("import.title")}
      subtitle={t("import.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          {preview && (
            <Button kind="tertiary" size="sm" icon="RefreshCw" onClick={reset}>
              {t("import.chooseAnother")}
            </Button>
          )}
          <span style={s.spacer} />
          <Button kind="secondary" size="sm" onClick={onClose}>
            {t("import.cancel")}
          </Button>
          <Button kind="primary" size="sm" icon="Check" disabled={!canSave} onClick={save}>
            {create.isPending ? t("import.saving") : t("import.save")}
          </Button>
        </div>
      }
    >
      {!preview || !draft ? (
        <>
          <div
            data-testid="import-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer?.files?.[0]);
            }}
            style={s.dropzone(dragOver)}
          >
            <Icon.Upload size={22} style={s.dropIcon} />
            <div style={s.dropTitle}>{parse.isPending ? t("import.parsing") : t("import.drop")}</div>
            <div style={s.dropHint}>{t("import.accepts")}</div>
            <Button kind="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={parse.isPending}>
              {t("import.pick")}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              data-testid="import-file-input"
              style={s.hiddenInput}
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {parse.isError && (
            <div role="alert" style={s.error}>
              {t("import.failed", { message: parse.error.message })}
            </div>
          )}
        </>
      ) : (
        <>
          <TrustBanner />
          {preview.warnings.length > 0 && (
            <div style={s.warnings}>
              <div style={s.sectionTitle}>
                <Icon.AlertTriangle size={13} /> {t("import.warnings")}
              </div>
              <ul style={s.list}>
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {preview.ignored_files.length > 0 && (
            <div style={s.ignored}>
              <div style={s.sectionTitle}>
                <Icon.EyeOff size={13} /> {t("import.ignoredTitle")}
              </div>
              <div style={s.ignoredHint}>{t("import.ignoredHint")}</div>
              <ul style={s.list}>
                {preview.ignored_files.map((f) => (
                  <li key={f} className="mono" style={s.ignoredFile}>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <FormField label={t("config.name")} required>
            <TextInput aria-label={t("config.name")} value={draft.name} onChange={(v) => patch({ name: v })} mono />
          </FormField>
          <FormField label={t("config.description")} hint={t("config.descriptionHint")}>
            <TextInput
              aria-label={t("config.description")}
              value={draft.description}
              onChange={(v) => patch({ description: v })}
            />
          </FormField>
          <FormField label={t("config.type")}>
            <SelectInput value={draft.type} onChange={(v) => patch({ type: v as SkillType })} options={typeOptions} />
          </FormField>
          <FormField label={t("config.body")} required>
            <BodyEditor
              ariaLabel={t("config.body")}
              value={draft.body}
              onChange={(v) => patch({ body: v })}
              filename={skillFilename(draft.name)}
              tokens={tokens}
            />
          </FormField>
        </>
      )}
    </Drawer>
  );
}
