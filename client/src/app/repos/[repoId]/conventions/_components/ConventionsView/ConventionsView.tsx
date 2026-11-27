/* ConventionsView — run / re-scan extraction, review candidates (accept,
   reject, edit), then merge accepted ones into a skill. Reject deletes the
   candidate on the server; the card stays visible, dimmed, until the next scan
   or reload (kept here as a snapshot). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { ConventionCandidate, Repo } from "@devdigest/shared";
import { PageContainer } from "@/components/page-shell";
import {
  useConventions,
  useExtractConventions,
  useRejectConvention,
  useUpdateConvention,
} from "@/lib/hooks/conventions";
import { githubBlobUrl } from "@/lib/github-urls";
import { useToast } from "@/lib/toast";
import { ConventionCard, type CardStatus } from "../ConventionCard";
import { CreateSkillModal } from "../CreateSkillModal";
import { mergeWithRejected } from "./helpers";
import { s } from "./styles";

export function ConventionsView({ repoId, repo }: { repoId: string; repo: Repo | undefined }) {
  const t = useTranslations("conventions");
  const toast = useToast();
  const list = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);
  const reject = useRejectConvention(repoId);
  const [rejected, setRejected] = React.useState<ConventionCandidate[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [cardError, setCardError] = React.useState<{ id: string; message: string } | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  const repoName = repo?.full_name ?? t("page.repoFallback");
  const candidates = list.data ?? [];
  const accepted = candidates.filter((c) => c.accepted);
  const rows = mergeWithRejected(candidates, rejected);

  const run = () => {
    setCardError(null);
    extract.mutate(undefined, { onSuccess: () => setRejected([]) });
  };

  const act = (id: string, p: Promise<unknown>) => {
    setBusyId(id);
    setCardError(null);
    p.catch((e: Error) => setCardError({ id, message: e.message })).finally(() => setBusyId(null));
  };

  const onReject = (c: ConventionCandidate) =>
    act(
      c.id,
      reject.mutateAsync(c.id).then(() => setRejected((r) => [...r, { ...c, accepted: false }])),
    );

  const statusOf = (c: ConventionCandidate): CardStatus =>
    rejected.some((r) => r.id === c.id) ? "rejected" : c.accepted ? "accepted" : "pending";

  const hrefOf = (c: ConventionCandidate) =>
    repo
      ? githubBlobUrl(
          repo.full_name,
          repo.default_branch,
          c.evidence_path,
          c.evidence_line_start ?? undefined,
          c.evidence_line_end ?? undefined,
        )
      : null;

  const extractError = extract.isError ? (
    <div role="alert" style={s.alert}>
      <strong>{t("page.extractionFailed")}</strong>
      <span>{extract.error.message}</span>
    </div>
  ) : null;

  if (list.isLoading) {
    return (
      <PageContainer title={`${t("page.headingPrefix")}${repoName}`} subtitle={t("page.subtitle")}>
        <div style={s.stack}>
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      </PageContainer>
    );
  }

  if (list.isError) {
    return (
      <PageContainer title={`${t("page.headingPrefix")}${repoName}`} subtitle={t("page.subtitle")}>
        <ErrorState title={t("page.loadError")} body={list.error.message} onRetry={() => list.refetch()} />
      </PageContainer>
    );
  }

  if (rows.length === 0) {
    return (
      <PageContainer title={`${t("page.headingPrefix")}${repoName}`} subtitle={t("page.subtitle")}>
        {extractError}
        {extract.isSuccess && <p style={s.summary}>{summary(t, extract.data)}</p>}
        <EmptyState
          icon="ListChecks"
          title={t("page.empty.title")}
          body={t("page.empty.body")}
          cta={extract.isPending ? t("page.scanning") : t("page.empty.cta")}
          onCta={run}
          ctaLoading={extract.isPending}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={`${t("page.headingPrefix")}${repoName}`}
      subtitle={
        extract.isSuccess
          ? summary(t, extract.data)
          : t("page.candidateCount", { count: candidates.length })
      }
      actions={
        <>
          <span style={s.counter}>
            {t("page.acceptedCount", { accepted: accepted.length, total: candidates.length })}
          </span>
          <Button kind="secondary" icon="RefreshCw" onClick={run} loading={extract.isPending}>
            {extract.isPending ? t("page.scanning") : t("page.rescan")}
          </Button>
          <Button
            kind="primary"
            icon="Sparkles"
            onClick={() => setModalOpen(true)}
            disabled={accepted.length === 0}
          >
            {t("page.createSkill")}
          </Button>
        </>
      }
    >
      {extractError}
      {rows.map((c) => (
        <ConventionCard
          key={c.id}
          convention={c}
          status={statusOf(c)}
          evidenceHref={hrefOf(c)}
          busy={busyId === c.id}
          error={cardError?.id === c.id ? cardError.message : null}
          onAccept={(on) => act(c.id, update.mutateAsync({ id: c.id, patch: { accepted: on } }))}
          onReject={() => onReject(c)}
          onSaveRule={(rule) => act(c.id, update.mutateAsync({ id: c.id, patch: { rule } }))}
        />
      ))}
      {modalOpen && (
        <CreateSkillModal
          repoId={repoId}
          repoName={repoName}
          accepted={accepted}
          onClose={() => setModalOpen(false)}
          onCreated={(skill) => {
            setModalOpen(false);
            toast.success(t("modal.created", { name: skill.name }));
          }}
        />
      )}
    </PageContainer>
  );
}

function summary(
  t: ReturnType<typeof useTranslations<"conventions">>,
  r: { sample_count: number; dropped_count: number },
): string {
  return t("page.scanSummary", { samples: r.sample_count, dropped: r.dropped_count });
}
