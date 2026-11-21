/* FindingsHoverCard — wraps a trigger (usually SeverityCountIcons) and shows a
   card listing the findings while hovered/focused. `onOpen` lets callers load
   the findings lazily; clicks inside never bubble (rows behind it navigate).
   The card is portalled to <body> with fixed positioning so containers with
   `overflow: hidden` (PR table, run accordion) can't clip it. */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
  Icon,
  SEV,
  CategoryTag,
  ConfidenceNum,
  type Category,
} from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { bySeverity } from "./helpers";

export function FindingsHoverCard({
  label,
  findings,
  loadingLabel,
  onOpen,
  children,
}: {
  /** Header text, e.g. "6 findings". */
  label: string;
  /** Undefined while loading. */
  findings?: FindingRecord[];
  loadingLabel?: string;
  onOpen?: () => void;
  children: React.ReactNode;
}) {
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = React.useState<React.CSSProperties | null>(null);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(
      8,
      Math.min(r.left, window.innerWidth - CARD_WIDTH - 8),
    );
    const below = r.bottom + GAP + CARD_MAX_HEIGHT <= window.innerHeight;
    setPos(
      below
        ? { left, top: r.bottom + GAP }
        : { left, bottom: window.innerHeight - r.top + GAP },
    );
    onOpen?.();
  };
  // Short delay so the pointer can cross the gap from the trigger to the card.
  const hide = () => {
    closeTimer.current = setTimeout(() => setPos(null), 120);
  };

  // Fixed position goes stale on scroll/resize → just close.
  React.useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);
  React.useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <span
      ref={triggerRef}
      style={{ display: "inline-flex" }}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{ ...card, ...pos }}
            onMouseEnter={show}
            onMouseLeave={hide}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={header}>
              <Icon.Info size={12} />
              {label}
            </div>
            {findings ? (
              bySeverity(findings).map((f) => <Row key={f.id} f={f} />)
            ) : (
              <div
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                {loadingLabel}
              </div>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}

function Row({ f }: { f: FindingRecord }) {
  const sev = SEV[f.severity];
  const I = Icon[sev.icon];
  const lines =
    f.start_line === f.end_line
      ? `${f.start_line}`
      : `${f.start_line}-${f.end_line}`;
  return (
    <div
      style={{
        padding: "10px 12px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        gap: 8,
      }}
    >
      <I size={14} style={{ color: sev.c, flexShrink: 0, marginTop: 2 }} />
      <div
        style={{
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {f.title}
          </span>
          <CategoryTag category={f.category as Category} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="mono"
            style={{ fontSize: 11.5, color: "var(--accent)" }}
          >
            {f.file}:{lines}
          </span>
          <ConfidenceNum value={f.confidence} />
        </div>
        <div style={clamp}>{f.rationale}</div>
      </div>
    </div>
  );
}

const CARD_WIDTH = 380;
const CARD_MAX_HEIGHT = 360;
const GAP = 6;

const card: React.CSSProperties = {
  position: "fixed",
  zIndex: 1000,
  width: CARD_WIDTH,
  maxHeight: CARD_MAX_HEIGHT,
  overflowY: "auto",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "0 8px 24px rgba(0,0,0,.35)",
  cursor: "default",
  textAlign: "left",
  whiteSpace: "normal",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

const clamp: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};
