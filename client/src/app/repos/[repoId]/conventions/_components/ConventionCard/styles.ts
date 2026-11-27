import type { CSSProperties } from "react";
import type { CardStatus } from "./ConventionCard";

const BORDER: Record<CardStatus, string> = {
  pending: "var(--border)",
  accepted: "var(--ok)",
  rejected: "var(--border)",
};

/** Co-located styles for ConventionCard. */
export const s = {
  card: (status: CardStatus): CSSProperties => ({
    padding: 16,
    borderRadius: 10,
    border: `1px solid ${BORDER[status]}`,
    background: "var(--bg-elevated)",
    opacity: status === "rejected" ? 0.55 : 1,
    marginBottom: 12,
  }),
  head: { display: "flex", alignItems: "flex-start", gap: 12 } satisfies CSSProperties,
  ruleCol: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  rule: {
    margin: 0,
    fontSize: 14.5,
    fontWeight: 600,
    lineHeight: 1.45,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  actions: { display: "flex", gap: 8, flexShrink: 0 } satisfies CSSProperties,
  badges: { display: "flex", gap: 6, marginTop: 6 } satisfies CSSProperties,
  editRow: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 } satisfies CSSProperties,
  evidence: {
    marginTop: 12,
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-surface)",
    overflow: "hidden",
  } satisfies CSSProperties,
  evidenceHead: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    fontSize: 12.5,
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,
  evidenceLink: { color: "var(--text-secondary)", textDecoration: "none" } satisfies CSSProperties,
  snippet: {
    margin: 0,
    padding: "10px 12px",
    fontSize: 12.5,
    lineHeight: 1.5,
    color: "var(--text-primary)",
    whiteSpace: "pre",
    overflowX: "auto",
  } satisfies CSSProperties,
  confidence: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    fontSize: 12.5,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  bar: { width: 140 } satisfies CSSProperties,
  error: { marginTop: 8, fontSize: 12.5, color: "var(--crit)" } satisfies CSSProperties,
} as const;
