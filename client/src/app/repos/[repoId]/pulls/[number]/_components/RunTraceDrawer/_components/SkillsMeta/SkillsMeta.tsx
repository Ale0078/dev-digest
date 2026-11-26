/* SkillsMeta — header meta for the Skills prompt block: `+K tok` (× N chunks
   in map-reduce) and the injected skills as `name vX`. Renders nothing for
   pre-M2 traces that lack the fields. */
"use client";

import React from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { SkillsBlockMeta } from "../../helpers";

const s = {
  wrap: { display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 } satisfies CSSProperties,
  tokens: { fontSize: 12, fontWeight: 600, color: "var(--accent)" } satisfies CSSProperties,
  chunks: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  chip: {
    fontSize: 11.5,
    padding: "1px 6px",
    borderRadius: 4,
    background: "var(--bg-hover)",
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
} as const;

export function SkillsMeta({ meta }: { meta: SkillsBlockMeta }) {
  const t = useTranslations("runs");
  if (meta.tokens == null && meta.skills.length === 0) return null;
  return (
    <span data-testid="skills-meta" style={s.wrap}>
      {meta.tokens != null && (
        <span className="mono tnum" style={s.tokens}>
          {t("trace.prompt.skillsTokens", { tokens: meta.tokens.toLocaleString("en-US") })}
        </span>
      )}
      {meta.tokens != null && meta.chunks > 1 && (
        <span className="mono tnum" style={s.chunks}>
          {t("trace.prompt.skillsChunks", { count: meta.chunks })}
        </span>
      )}
      {meta.skills.map((sk) => (
        <span key={sk.id} className="mono" style={s.chip}>
          {t("trace.prompt.skillVersion", { name: sk.name, version: sk.version })}
        </span>
      ))}
    </span>
  );
}
