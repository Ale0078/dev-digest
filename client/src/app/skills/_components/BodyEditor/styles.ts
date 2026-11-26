import type { CSSProperties } from "react";
import { LINE_HEIGHT_PX } from "./constants";

const PAD_Y = 10;

/** Co-located styles for BodyEditor. Gutter and textarea share font size,
    line height and vertical padding so line numbers align. */
export const s = {
  wrap: {
    border: "1px solid var(--border-strong)",
    borderRadius: 8,
    overflow: "hidden",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  headerIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  filename: { fontSize: 12.5, color: "var(--text-secondary)" } satisfies CSSProperties,
  tokens: { marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  editor: { display: "flex", alignItems: "stretch" } satisfies CSSProperties,
  gutter: {
    flexShrink: 0,
    minWidth: 40,
    padding: `${PAD_Y}px 8px`,
    textAlign: "right",
    fontSize: 12.5,
    lineHeight: `${LINE_HEIGHT_PX}px`,
    color: "var(--text-muted)",
    background: "var(--bg-surface)",
    borderRight: "1px solid var(--border)",
    overflow: "hidden",
    userSelect: "none",
  } satisfies CSSProperties,
  textarea: {
    flex: 1,
    minWidth: 0,
    resize: "vertical",
    padding: `${PAD_Y}px 12px`,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: 12.5,
    lineHeight: `${LINE_HEIGHT_PX}px`,
    whiteSpace: "pre",
    overflowX: "auto",
  } satisfies CSSProperties,
} as const;
