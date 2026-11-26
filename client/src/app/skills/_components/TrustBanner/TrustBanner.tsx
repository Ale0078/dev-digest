/* TrustBanner — shown for imported skills (import drawer + skill detail). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { CSSProperties } from "react";

const s = {
  wrap: {
    display: "flex",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    color: "var(--text-primary)",
    marginBottom: 16,
  } satisfies CSSProperties,
  icon: { color: "var(--warn)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
  title: { fontSize: 13, fontWeight: 650 } satisfies CSSProperties,
  body: { fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.45 } satisfies CSSProperties,
} as const;

export function TrustBanner() {
  const t = useTranslations("skills");
  return (
    <div role="note" style={s.wrap}>
      <Icon.Shield size={15} style={s.icon} />
      <div>
        <div style={s.title}>{t("trust.title")}</div>
        <div style={s.body}>{t("trust.body")}</div>
      </div>
    </div>
  );
}
