import type { CSSProperties } from "react";
import type { DiffKind } from "./helpers";

const DIFF_BG: Record<DiffKind, string> = { same: "transparent", add: "var(--ok-bg)", del: "var(--crit-bg)" };
const DIFF_FG: Record<DiffKind, string> = {
  same: "var(--text-secondary)",
  add: "var(--text-primary)",
  del: "var(--text-primary)",
};

/** Co-located styles for VersionsTab. */
export const s = {
  wrap: { maxWidth: 900 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700, marginBottom: 14 } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    border: "1px solid var(--border)",
    borderRadius: 10,
    overflow: "hidden",
  } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    minHeight: 48,
  } satisfies CSSProperties,
  vnum: { fontSize: 13, fontWeight: 700, minWidth: 34 } satisfies CSSProperties,
  message: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  messageMuted: { flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text-muted)", fontStyle: "italic" } satisfies CSSProperties,
  date: { fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" } satisfies CSSProperties,
  actions: { display: "flex", gap: 8 } satisfies CSSProperties,
  diff: { margin: 0, padding: "12px 0", fontSize: 12.5, lineHeight: "20px", overflowX: "auto" } satisfies CSSProperties,
  diffLine: (kind: DiffKind): CSSProperties => ({
    padding: "0 16px",
    background: DIFF_BG[kind],
    color: DIFF_FG[kind],
    whiteSpace: "pre",
  }),
  diffMark: { display: "inline-block", width: 18, color: "var(--text-muted)", userSelect: "none" } satisfies CSSProperties,
  noChanges: { padding: "18px 24px", fontSize: 13.5, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
