/* Skill type + source badges. Shared by /skills (cards, detail header) and the
   agent editor's Skills tab. Labels come from the `skills` namespace. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { SkillSource, SkillType } from "@devdigest/shared";
import { sourceBadgeKey } from "../../lib/skills";

const TYPE_COLOR: Record<SkillType, { c: string; bg: string }> = {
  rubric: { c: "var(--accent)", bg: "var(--accent-bg)" },
  convention: { c: "var(--ok)", bg: "var(--ok-bg)" },
  security: { c: "var(--crit)", bg: "var(--crit-bg)" },
  custom: { c: "var(--info)", bg: "var(--info-bg)" },
};

export function SkillTypeBadge({ type }: { type: SkillType }) {
  const t = useTranslations("skills");
  const col = TYPE_COLOR[type] ?? TYPE_COLOR.custom;
  return (
    <Badge color={col.c} bg={col.bg} mono>
      {t(`type.${type}`)}
    </Badge>
  );
}

export function SkillSourceBadge({ source }: { source: SkillSource }) {
  const t = useTranslations("skills");
  const key = sourceBadgeKey(source);
  const imported = key === "imported";
  return (
    <Badge
      color={imported ? "var(--warn)" : "var(--text-secondary)"}
      bg={imported ? "var(--warn-bg)" : "var(--bg-hover)"}
      icon={imported ? "Upload" : undefined}
    >
      {t(`source.${key}`)}
    </Badge>
  );
}
