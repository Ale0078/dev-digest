import type { CSSProperties } from "react";

/** Co-located styles for CreateSkillModal. */
export const s = {
  footer: { display: "flex", gap: 10, justifyContent: "flex-end" } satisfies CSSProperties,
  body: { padding: 24 } satisfies CSSProperties,
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 160,
    overflowY: "auto",
    padding: "10px 12px",
    border: "1px solid var(--border)",
    borderRadius: 7,
  } satisfies CSSProperties,
  listItem: { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4 } satisfies CSSProperties,
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } satisfies CSSProperties,
  error: { marginTop: 6, fontSize: 12.5, color: "var(--crit)" } satisfies CSSProperties,
} as const;
