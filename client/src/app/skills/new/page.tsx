/* Route: /skills/new — create a manual skill (Config form in create mode). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SkillsShell } from "../_components/SkillsShell";
import { SkillCreateView } from "./_components/SkillCreateView";

export default function NewSkillPage() {
  const t = useTranslations("skills");
  return (
    <SkillsShell
      crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills"), href: "/skills" }, { label: t("create.crumb") }]}
    >
      <SkillCreateView />
    </SkillsShell>
  );
}
