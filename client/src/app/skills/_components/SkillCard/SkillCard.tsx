/* SkillCard — one skill in the /skills list: name, global toggle, truncated
   description, type + source badges, and the `N agents · X% pull · Y% accept`
   footer (— when there is no data). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillSourceBadge, SkillTypeBadge } from "../../../../components/skill-badges";
import { formatRate } from "../../../../lib/skills";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
}: {
  skill: Skill;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onClick?.();
      }}
      style={s.card(!!active, skill.enabled)}
    >
      <div style={s.headerRow}>
        <Icon.Sparkles size={14} style={s.icon} />
        <span style={s.name}>{skill.name}</span>
        {onToggle && (
          <span onClick={(e) => e.stopPropagation()} aria-label={t("card.toggleLabel", { name: skill.name })}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </span>
        )}
      </div>
      <div style={s.description} title={skill.description || undefined}>
        {skill.description || t("card.noDescription")}
      </div>
      <div style={s.badges}>
        <SkillTypeBadge type={skill.type} />
        <SkillSourceBadge source={skill.source} />
      </div>
      <div className="tnum" style={s.footer}>
        {t("card.footer", {
          agents: skill.agent_count,
          pull: formatRate(skill.stats.pull_rate),
          accept: formatRate(skill.stats.accept_rate),
        })}
      </div>
    </div>
  );
}
