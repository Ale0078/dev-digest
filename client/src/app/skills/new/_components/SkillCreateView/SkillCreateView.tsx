/* SkillCreateView — right pane of /skills/new: empty draft → POST /skills
   (source manual) → navigate to the new skill's detail. */
"use client";

import React from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { useCreateSkill } from "../../../../../lib/hooks/skills";
import { useToast } from "../../../../../lib/toast";
import { EMPTY_DRAFT, SkillConfigForm, type SkillDraft } from "../../../_components/SkillConfigForm";

const s = {
  head: { display: "flex", alignItems: "center", gap: 12, padding: "16px 28px 0" } satisfies CSSProperties,
  h1: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  body: { flex: 1, overflow: "auto", padding: 28 } satisfies CSSProperties,
} as const;

export function SkillCreateView() {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const create = useCreateSkill();
  const [draft, setDraft] = React.useState<SkillDraft>(EMPTY_DRAFT);
  const [enabled, setEnabled] = React.useState(true);

  return (
    <>
      <div style={s.head}>
        <Icon.Sparkles size={18} style={{ color: "var(--accent)" }} />
        <h1 style={s.h1}>{t("create.title")}</h1>
      </div>
      <div style={s.body}>
        <SkillConfigForm
          mode="create"
          draft={draft}
          onChange={(p) => setDraft((d) => ({ ...d, ...p }))}
          dirty={false}
          enabled={enabled}
          onEnabledChange={setEnabled}
          saving={create.isPending}
          onSave={() =>
            create.mutate(
              { ...draft, source: "manual", enabled },
              {
                onSuccess: (skill) => {
                  toast.success(t("create.created", { name: skill.name }));
                  router.push(`/skills/${skill.id}?tab=config`);
                },
              },
            )
          }
        />
      </div>
    </>
  );
}
