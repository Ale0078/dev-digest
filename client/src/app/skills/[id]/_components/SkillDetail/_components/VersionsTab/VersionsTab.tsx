/* VersionsTab — `vN · message · date`, Current badge on the latest, Diff (line
   diff of that version's body vs the current body) and Restore (confirm →
   creates a NEW version with vN's content; history is never rewritten). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Modal, Skeleton } from "@devdigest/ui";
import type { Skill, SkillVersion } from "@devdigest/shared";
import { useRestoreSkillVersion, useSkillVersions } from "../../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../../lib/toast";
import { ConfirmDialog } from "../../../../../_components/ConfirmDialog";
import { formatVersionDate, hasChanges, lineDiff } from "./helpers";
import { DIFF_MARK } from "./constants";
import { s } from "./styles";

export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data: versions, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const restore = useRestoreSkillVersion();
  const [diffOf, setDiffOf] = React.useState<SkillVersion | null>(null);
  const [restoreOf, setRestoreOf] = React.useState<SkillVersion | null>(null);

  if (isLoading) return <Skeleton height={140} />;
  if (isError || !versions) return <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />;

  const doRestore = (v: SkillVersion) =>
    restore.mutate(
      { id: skill.id, version: v.version },
      {
        onSuccess: (data) => {
          setRestoreOf(null);
          toast.success(t("versions.restoredToast", { version: v.version, next: data.version }));
        },
      },
    );

  const diff = diffOf ? lineDiff(diffOf.body, skill.body) : [];

  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("versions.title")}</h2>
      {versions.length === 0 ? (
        <div style={s.muted}>{t("versions.empty")}</div>
      ) : (
        <ul style={s.list}>
          {versions.map((v) => {
            const current = v.version === skill.version;
            return (
              <li key={v.version} data-testid={`version-${v.version}`} style={s.row}>
                <span className="mono" style={s.vnum}>
                  {t("detail.version", { version: v.version })}
                </span>
                {current && (
                  <Badge color="var(--ok)" bg="var(--ok-bg)">
                    {t("versions.current")}
                  </Badge>
                )}
                <span style={v.message ? s.message : s.messageMuted}>{v.message || t("versions.noMessage")}</span>
                <span style={s.date}>{formatVersionDate(v.created_at)}</span>
                {!current && (
                  <span style={s.actions}>
                    <Button kind="ghost" size="sm" icon="Code" onClick={() => setDiffOf(v)}>
                      {t("versions.diff")}
                    </Button>
                    <Button kind="secondary" size="sm" icon="History" onClick={() => setRestoreOf(v)}>
                      {t("versions.restore")}
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {diffOf && (
        <Modal
          width={900}
          title={t("versions.diffTitle", { version: diffOf.version, current: skill.version })}
          subtitle={t("versions.diffSubtitle")}
          onClose={() => setDiffOf(null)}
          footer={
            <Button kind="secondary" size="sm" onClick={() => setDiffOf(null)}>
              {t("versions.close")}
            </Button>
          }
        >
          {hasChanges(diff) ? (
            <pre className="mono" data-testid="version-diff" style={s.diff}>
              {diff.map((l, i) => (
                <div key={i} data-kind={l.kind} style={s.diffLine(l.kind)}>
                  <span aria-hidden="true" style={s.diffMark}>
                    {DIFF_MARK[l.kind]}
                  </span>
                  {l.text || " "}
                </div>
              ))}
            </pre>
          ) : (
            <div style={s.noChanges}>{t("versions.noChanges")}</div>
          )}
        </Modal>
      )}

      {restoreOf && (
        <ConfirmDialog
          title={t("versions.restoreConfirm.title", { version: restoreOf.version })}
          confirmLabel={t("versions.restoreConfirm.confirm")}
          cancelLabel={t("versions.restoreConfirm.cancel")}
          pending={restore.isPending}
          onCancel={() => setRestoreOf(null)}
          onConfirm={() => doRestore(restoreOf)}
        >
          {t("versions.restoreConfirm.body", { version: restoreOf.version, next: skill.version + 1 })}
        </ConfirmDialog>
      )}
    </div>
  );
}
