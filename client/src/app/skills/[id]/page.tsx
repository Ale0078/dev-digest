/* Route: /skills/:id — skill list (left) + skill detail (right). Tab state
   lives in ?tab= (config · preview · stats · versions). */
"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ErrorState, Skeleton } from "@devdigest/ui";
import { useSkill } from "../../../lib/hooks/skills";
import { ApiError } from "../../../lib/api";
import { SkillsShell } from "../_components/SkillsShell";
import { SkillDetail, toDetailTab } from "./_components/SkillDetail";

export default function SkillDetailPage() {
  const t = useTranslations("skills");
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { data: skill, isLoading, isError, error, refetch } = useSkill(id);

  const tab = toDetailTab(search.get("tab"));
  const setTab = (next: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", next);
    router.replace(`/skills/${id}?${sp.toString()}`);
  };

  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbSkills"), href: "/skills" },
    { label: skill?.name ?? t("detail.crumbSkill") },
  ];

  return (
    <SkillsShell crumb={crumb} activeId={id} tab={tab}>
      {isError || (!isLoading && !skill) ? (
        <ErrorState
          title={t("detail.loadErrorTitle")}
          body={error instanceof ApiError ? error.message : t("detail.loadError")}
          onRetry={() => refetch()}
        />
      ) : isLoading || !skill ? (
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton height={24} width={240} />
          <Skeleton height={200} />
        </div>
      ) : (
        <SkillDetail skill={skill} tab={tab} onTab={setTab} />
      )}
    </SkillsShell>
  );
}
