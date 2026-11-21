import type { CSSProperties } from "react";
import { SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";

/** Co-located styles for FindingsPanel (extracted from inline styles). */
export const s = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  divider: {
    width: 1,
    height: 18,
    background: "var(--border)",
    margin: "0 2px",
  } satisfies CSSProperties,
  toggleGroup: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  sevGroup: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
} as const;

/** Severity counter chip. Colours come from SEV; the active state is shown by a
 *  filled background (not hover), the other levels are dimmed while a filter is on. */
export function sevChip(sev: Severity, state: "idle" | "active" | "muted"): CSSProperties {
  const { c } = SEV[sev];
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 999,
    border: `1px solid ${c}`,
    background: state === "active" ? c : "transparent",
    color: state === "active" ? "var(--bg-primary)" : c,
    opacity: state === "muted" ? 0.45 : 1,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
