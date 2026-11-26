/* Route: /skills — skill list (left) with a "select a skill" prompt on the right.
   The detail lives at /skills/:id, creation at /skills/new. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@devdigest/ui";
import { SkillsShell } from "./_components/SkillsShell";

export default function SkillsPage() {
  const t = useTranslations("skills");
  return (
    <SkillsShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 28 }}>
        <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />
      </div>
    </SkillsShell>
  );
}
