import type { CSSProperties } from "react";

/** Co-located styles for ConventionsView. */
export const s = {
  stack: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  counter: { fontSize: 13, color: "var(--text-muted)", alignSelf: "center" } satisfies CSSProperties,
  summary: { fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" } satisfies CSSProperties,
  alert: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "10px 14px",
    marginBottom: 12,
    borderRadius: 8,
    border: "1px solid var(--crit)",
    background: "var(--crit-bg)",
    color: "var(--text-primary)",
    fontSize: 13,
  } satisfies CSSProperties,
} as const;
