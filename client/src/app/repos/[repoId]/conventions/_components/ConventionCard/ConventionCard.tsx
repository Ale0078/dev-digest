"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon, ProgressBar, Textarea } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { s } from "./styles";

export type CardStatus = "pending" | "accepted" | "rejected";

export interface ConventionCardProps {
  convention: ConventionCandidate;
  status: CardStatus;
  /** GitHub blob link for the evidence, or null when the repo is unknown. */
  evidenceHref: string | null;
  busy?: boolean;
  error?: string | null;
  onAccept: (accepted: boolean) => void;
  onReject: () => void;
  onSaveRule: (rule: string) => void;
}

/** "path:start-end" (or just the path when the snippet is no longer found). */
export function evidenceLocation(c: ConventionCandidate): string {
  if (c.evidence_line_start == null) return c.evidence_path;
  const end = c.evidence_line_end ?? c.evidence_line_start;
  return `${c.evidence_path}:${c.evidence_line_start}${end !== c.evidence_line_start ? `-${end}` : ""}`;
}

/** One extracted convention: rule (editable), evidence, confidence, Accept / Reject. */
export function ConventionCard({
  convention: c,
  status,
  evidenceHref,
  busy = false,
  error,
  onAccept,
  onReject,
  onSaveRule,
}: ConventionCardProps) {
  const t = useTranslations("conventions.card");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(c.rule);
  const rejected = status === "rejected";
  const accepted = status === "accepted";
  const location = evidenceLocation(c);
  const pct = Math.round(c.confidence * 100);

  const startEdit = () => {
    setDraft(c.rule);
    setEditing(true);
  };
  const save = () => {
    const rule = draft.trim();
    if (rule && rule !== c.rule) onSaveRule(rule);
    setEditing(false);
  };

  return (
    <article style={s.card(status)} data-testid="convention-card" data-status={status}>
      <div style={s.head}>
        <div style={s.ruleCol}>
          {editing ? (
            <>
              <div role="group" aria-label={t("ruleLabel")}>
                <Textarea value={draft} onChange={setDraft} rows={3} />
              </div>
              <div style={s.editRow}>
                <Button kind="ghost" size="sm" onClick={() => setEditing(false)}>
                  {t("cancel")}
                </Button>
                <Button kind="primary" size="sm" onClick={save} disabled={!draft.trim()}>
                  {t("save")}
                </Button>
              </div>
            </>
          ) : (
            <p style={s.rule}>{c.rule}</p>
          )}
          {(accepted || rejected) && (
            <div style={s.badges}>
              {accepted && (
                <Badge icon="Check" color="var(--ok)" bg="var(--ok-bg)">
                  {t("accepted")}
                </Badge>
              )}
              {rejected && (
                <Badge icon="X" color="var(--text-muted)">
                  {t("rejected")}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div style={s.actions}>
          {!editing && !rejected && (
            <Button kind="ghost" size="sm" icon="Edit" onClick={startEdit} disabled={busy}>
              {t("edit")}
            </Button>
          )}
          <Button
            kind={accepted ? "primary" : "secondary"}
            size="sm"
            icon="Check"
            aria-pressed={accepted}
            onClick={() => onAccept(!accepted)}
            disabled={busy || rejected}
          >
            {accepted ? t("accepted") : t("accept")}
          </Button>
          <Button kind="ghost" size="sm" icon="X" onClick={onReject} disabled={busy || rejected}>
            {rejected ? t("rejected") : t("reject")}
          </Button>
        </div>
      </div>

      <div style={s.evidence}>
        <div style={s.evidenceHead} className="mono">
          {evidenceHref ? (
            <a
              href={evidenceHref}
              target="_blank"
              rel="noreferrer"
              style={s.evidenceLink}
              aria-label={t("openEvidence", { location })}
            >
              {location} <Icon.ExternalLink size={11} />
            </a>
          ) : (
            <span>{location}</span>
          )}
        </div>
        <pre style={s.snippet} className="mono">
          {c.evidence_snippet}
        </pre>
      </div>

      <div style={s.confidence}>
        <div style={s.bar}>
          <ProgressBar value={pct} />
        </div>
        <span>{t("confidencePct", { value: pct })}</span>
      </div>
      {error && (
        <div role="alert" style={s.error}>
          {t("actionFailed", { message: error })}
        </div>
      )}
    </article>
  );
}
