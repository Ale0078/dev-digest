import type { CSSProperties } from "react";

/** Co-located styles for SkillDetail. */
export const s = {
  wrap: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 } satisfies CSSProperties,
  head: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "16px 28px 0",
    flexShrink: 0,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  headIcon: { color: "var(--accent)" } satisfies CSSProperties,
  h1: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  headActions: { marginLeft: "auto" } satisfies CSSProperties,
  tabsBar: { marginTop: 14, flexShrink: 0 } satisfies CSSProperties,
  body: { flex: 1, minHeight: 0, overflow: "auto", padding: 28 } satisfies CSSProperties,
  confirmP: { margin: "0 0 10px" } satisfies CSSProperties,
  confirmMuted: { margin: 0, color: "var(--text-muted)" } satisfies CSSProperties,
  agentList: { margin: 0, paddingLeft: 20, color: "var(--text-primary)" } satisfies CSSProperties,
} as const;
