/* Conventions — /repos/:repoId/conventions. Extract house rules from the
   cloned repo, review them, and turn accepted ones into a skill. */
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { ConventionsView } from "./_components/ConventionsView";

export default function ConventionsPage() {
  const t = useTranslations("conventions.page");
  const { repoId } = useParams<{ repoId: string }>();
  const { repos } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const repo = repos.find((r) => r.id === repoId);
  const crumb = [{ label: t("crumbLab") }, { label: t("crumbConventions") }];

  return (
    <AppShell crumb={crumb}>
      {repoNotFound ? <RepoNotFound /> : <ConventionsView repoId={repoId} repo={repo} />}
    </AppShell>
  );
}
