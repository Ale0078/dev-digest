/* SkillDetail — right pane of /skills/:id: header (name, type, vN, source),
   trust banner for imported skills, and the Config / Preview / Stats / Versions
   tabs (?tab=). Owns the draft so Preview renders unsaved Config edits. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon, Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkill, useSkillStats, useUpdateSkill } from "../../../../../lib/hooks/skills";
import { useToast } from "../../../../../lib/toast";
import { isImportedSource } from "../../../../../lib/skills";
import { SkillSourceBadge, SkillTypeBadge } from "../../../../../components/skill-badges";
import {
  SkillConfigForm,
  draftChanges,
  draftFromSkill,
  isDraftDirty,
  type SkillDraft,
} from "../../../_components/SkillConfigForm";
import { TrustBanner } from "../../../_components/TrustBanner";
import { ConfirmDialog } from "../../../_components/ConfirmDialog";
import { PreviewTab } from "./_components/PreviewTab";
import { StatsTab } from "./_components/StatsTab";
import { VersionsTab } from "./_components/VersionsTab";
import { DETAIL_TABS, type DetailTab } from "./constants";
import { s } from "./styles";

export function SkillDetail({ skill, tab, onTab }: { skill: Skill; tab: DetailTab; onTab: (t: string) => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const update = useUpdateSkill();
  const del = useDeleteSkill();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const stats = useSkillStats(skill.id, { enabled: confirmDelete });

  // Draft = unsaved edits. Reset whenever the saved content changes identity
  // (other skill, new version after save/restore); toggling `enabled` keeps it.
  const savedKey = `${skill.id}:${skill.version}`;
  const [draftKey, setDraftKey] = React.useState(savedKey);
  const [draft, setDraft] = React.useState<SkillDraft>(() => draftFromSkill(skill));
  if (draftKey !== savedKey) {
    setDraftKey(savedKey);
    setDraft(draftFromSkill(skill));
  }
  const saved = draftFromSkill(skill);
  const dirty = isDraftDirty(draft, saved);

  const tabs = DETAIL_TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));

  const save = (note: string, onSaved: () => void) => {
    const changes = draftChanges(draft, saved);
    const noteOnly = Object.keys(changes).length === 0;
    update.mutate(
      { id: skill.id, patch: { ...changes, ...(note ? { message: note } : {}) } },
      {
        onSuccess: (data) => {
          onSaved();
          toast.success(
            noteOnly
              ? t("config.noteSavedToast", { version: data.version })
              : t("config.savedToast", { version: data.version }),
          );
        },
      },
    );
  };

  const doDelete = () =>
    del.mutate(skill.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        router.push("/skills");
      },
    });

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <Icon.Sparkles size={18} style={s.headIcon} />
        <h1 style={s.h1}>{skill.name}</h1>
        <SkillTypeBadge type={skill.type} />
        <Badge color="var(--text-secondary)" mono>
          {t("detail.version", { version: skill.version })}
        </Badge>
        <SkillSourceBadge source={skill.source} />
        {!skill.enabled && <Badge color="var(--text-muted)">{t("detail.disabled")}</Badge>}
        <div style={s.headActions}>
          <Button kind="danger" size="sm" icon="Trash" onClick={() => setConfirmDelete(true)}>
            {t("detail.delete")}
          </Button>
        </div>
      </div>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      <div style={s.body}>
        {isImportedSource(skill.source) && <TrustBanner />}
        {tab === "config" && (
          <SkillConfigForm
            mode="edit"
            draft={draft}
            onChange={(p) => setDraft((d) => ({ ...d, ...p }))}
            dirty={dirty}
            enabled={skill.enabled}
            onEnabledChange={(enabled) => update.mutate({ id: skill.id, patch: { enabled } })}
            saving={update.isPending}
            onSave={save}
          />
        )}
        {tab === "preview" && <PreviewTab draft={draft} />}
        {tab === "stats" && <StatsTab skillId={skill.id} />}
        {tab === "versions" && <VersionsTab skill={skill} />}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          danger
          title={t("detail.deleteConfirm.title", { name: skill.name })}
          confirmLabel={t("detail.deleteConfirm.confirm")}
          cancelLabel={t("detail.deleteConfirm.cancel")}
          pending={del.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={doDelete}
        >
          <p style={s.confirmP}>{t("detail.deleteConfirm.body")}</p>
          {stats.isLoading ? (
            <p style={s.confirmMuted}>{t("detail.deleteConfirm.loadingAgents")}</p>
          ) : stats.data && stats.data.agents.length > 0 ? (
            <>
              <p style={s.confirmP}>{t("detail.deleteConfirm.affected")}</p>
              <ul style={s.agentList}>
                {stats.data.agents.map((a) => (
                  <li key={a.id}>{a.name}</li>
                ))}
              </ul>
            </>
          ) : (
            <p style={s.confirmMuted}>{t("detail.deleteConfirm.noAgents")}</p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
