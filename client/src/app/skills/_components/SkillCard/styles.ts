import type { CSSProperties } from "react";

/** Co-located styles for SkillCard. */
export const s = {
  card: (active: boolean, enabled: boolean): CSSProperties => ({
    padding: 12,
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid " + (active ? "var(--border-strong)" : "var(--border)"),
    background: active ? "var(--bg-hover)" : "var(--bg-elevated)",
    opacity: enabled ? 1 : 0.6,
    marginBottom: 8,
  }),
  headerRow: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  icon: { color: "var(--accent)", flexShrink: 0 } satisfies CSSProperties,
  name: {
    fontSize: 14,
    fontWeight: 600,
    flex: 1,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  description: {
    fontSize: 12.5,
    color: "var(--text-muted)",
    margin: "6px 0 8px",
    lineHeight: 1.4,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  } satisfies CSSProperties,
  badges: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } satisfies CSSProperties,
  footer: { fontSize: 12, color: "var(--text-muted)", marginTop: 8 } satisfies CSSProperties,
} as const;
