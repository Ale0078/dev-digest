import type { CSSProperties } from "react";

/** Co-located styles for SkillConfigForm. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", marginBottom: 20 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  enabledLabel: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  actions: { display: "flex", alignItems: "center", gap: 12, marginTop: 4 } satisfies CSSProperties,
  invalid: { fontSize: 12.5, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
