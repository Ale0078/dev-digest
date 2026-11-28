"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SectionLabel, Button } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi, type DiffFindingApi } from "@/components/diff-viewer";
import { latestReviewPerAgent } from "@/components/findings-summary/helpers";
import { usePrComments, useCreatePrComment, usePrReviews, useFindingAction } from "@/lib/hooks/reviews";
import { useSmartDiff } from "@/lib/hooks/smart-diff";
import { notify } from "@/lib/toast";
import type { PrFile } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { buildViewGroups } from "./helpers";

interface DiffTabProps {
  prId: string | null;
  filesCount: number;
  files: PrFile[];
  /** Inline commenting is offered only on open PRs (GitHub rejects otherwise). */
  canComment?: boolean;
  repoFullName?: string | null;
  headSha?: string | null;
}

export function DiffTab({ prId, filesCount, files, canComment, repoFullName, headSha }: DiffTabProps) {
  const t = useTranslations("prReview");
  const { data: comments } = usePrComments(prId);
  const { data: reviews } = usePrReviews(prId);
  const smart = useSmartDiff(prId);
  const create = useCreatePrComment(prId);
  const action = useFindingAction();
  const [order, setOrder] = React.useState<"smart" | "original">("smart");
  // null = follow the default (shown when there is anything to show).
  const [showOverride, setShowOverride] = React.useState<boolean | null>(null);

  const latest = React.useMemo(() => latestReviewPerAgent(reviews ?? []), [reviews]);
  const findings = React.useMemo(() => latest.flatMap((r) => r.findings), [latest]);
  const hasReview = reviews ? latest.length > 0 : undefined;
  const commentCount = comments?.length ?? 0;
  const annotationCount = commentCount + findings.length;
  const show = showOverride ?? annotationCount > 0;

  const groups = React.useMemo(() => {
    if (order !== "smart" || !smart.data || smart.isError) return undefined;
    return buildViewGroups(
      smart.data,
      files,
      new Set(findings.map((f) => f.file)),
      hasReview,
      (key) => t(`smartDiff.${key}`),
    );
  }, [order, smart.data, smart.isError, files, findings, hasReview, t]);

  const commenting: DiffCommentApi = {
    comments: comments ?? [],
    canComment: !!canComment && !!prId,
    showComments: show,
    posting: create.isPending,
    onSubmit: async (input) => {
      try {
        const res = await create.mutateAsync(input);
        setShowOverride(true); // a just-posted comment shouldn't stay hidden
        return res;
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Couldn't post the comment to GitHub.");
        throw err;
      }
    },
  };

  const findingApi: DiffFindingApi = {
    findings,
    show,
    renderFinding: (f) => (
      <FindingCard
        f={f}
        defaultExpanded
        repoFullName={repoFullName}
        headSha={headSha}
        pending={action.isPending}
        onAction={(act) => prId && action.mutate({ findingId: f.id, action: act, prId })}
      />
    ),
  };

  return (
    <section>
      <SectionLabel
        icon="Code"
        right={
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Button kind="ghost" size="sm" active={order === "smart"} onClick={() => setOrder("smart")}>
              {t("smartDiff.smartOrder")}
            </Button>
            <Button kind="ghost" size="sm" active={order === "original"} onClick={() => setOrder("original")}>
              {t("smartDiff.originalOrder")}
            </Button>
            {annotationCount > 0 && (
              <Button
                kind="ghost"
                size="sm"
                icon={show ? "EyeOff" : "Eye"}
                onClick={() => setShowOverride(!show)}
              >
                {show ? t("smartDiff.hideAnnotations") : t("smartDiff.showAnnotations")} ({annotationCount})
              </Button>
            )}
          </span>
        }
      >
        {t("smartDiff.filesChanged", { count: filesCount })}
      </SectionLabel>
      <DiffViewer files={files} commenting={commenting} findingApi={findingApi} groups={groups} />
    </section>
  );
}
