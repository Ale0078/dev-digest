import type { CSSProperties } from "react";

/** Co-located styles for SkillsShell (mirrors the /agents/:id frame). */
export const s = {
  frame: { display: "flex", height: "calc(100vh - 52px)" } satisfies CSSProperties,
  sidebar: {
    width: 300,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  sidebarHead: { padding: "16px 16px 12px" } satisfies CSSProperties,
  titleRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 } satisfies CSSProperties,
  h1: { fontSize: 18, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  search: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "7px 12px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  searchIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  listScroll: { flex: 1, overflow: "auto", padding: "0 12px 12px" } satisfies CSSProperties,
  gap: { height: 8 } satisfies CSSProperties,
  noMatch: { fontSize: 13, color: "var(--text-muted)", padding: "12px 4px" } satisfies CSSProperties,
  detail: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 } satisfies CSSProperties,
} as const;
