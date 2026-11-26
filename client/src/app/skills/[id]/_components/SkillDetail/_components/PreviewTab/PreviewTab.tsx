/* PreviewTab — the skill block exactly as the reviewing agent receives it
   (`renderSkillBlock`), rendered from the live, possibly unsaved draft. */
"use client";

import React from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Markdown } from "@devdigest/ui";
import { renderSkillBlock } from "../../../../../../../lib/skills";
import type { SkillDraft } from "../../../../../_components/SkillConfigForm";

const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  hint: { fontSize: 13, color: "var(--text-muted)", margin: "4px 0 16px" } satisfies CSSProperties,
  card: {
    padding: "18px 22px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    fontSize: 14,
  } satisfies CSSProperties,
} as const;

export function PreviewTab({ draft }: { draft: SkillDraft }) {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("preview.title")}</h2>
      <p style={s.hint}>{t("preview.hint")}</p>
      <div data-testid="skill-preview" style={s.card}>
        <Markdown>{renderSkillBlock(draft)}</Markdown>
      </div>
    </div>
  );
}
