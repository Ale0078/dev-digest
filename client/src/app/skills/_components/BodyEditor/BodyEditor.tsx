/* BodyEditor — markdown body textarea with a line-number gutter (no editor
   dependency). Header: `<name>.md`, an `unsaved` badge when dirty, and the live
   token count passed in by the parent. Used by the Config form and ImportDrawer. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon } from "@devdigest/ui";
import { lineNumbers } from "./helpers";
import { EDITOR_ROWS } from "./constants";
import { s } from "./styles";

export function BodyEditor({
  value,
  onChange,
  filename,
  dirty,
  tokens,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  filename: string;
  dirty?: boolean;
  /** undefined = not counted yet. */
  tokens?: number;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const t = useTranslations("skills");
  const gutterRef = React.useRef<HTMLDivElement>(null);
  const lines = lineNumbers(value);
  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <Icon.FileText size={13} style={s.headerIcon} />
        <span className="mono" style={s.filename}>
          {filename}
        </span>
        {dirty && (
          <Badge color="var(--warn)" bg="var(--warn-bg)">
            {t("config.unsaved")}
          </Badge>
        )}
        <span className="tnum" data-testid="body-tokens" style={s.tokens}>
          {tokens == null ? t("config.tokensPending") : t("config.tokens", { count: tokens })}
        </span>
      </div>
      <div style={s.editor}>
        <div ref={gutterRef} aria-hidden="true" className="mono" style={s.gutter}>
          {lines.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        <textarea
          aria-label={ariaLabel}
          className="mono"
          value={value}
          rows={EDITOR_ROWS}
          wrap="off"
          spellCheck={false}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          style={s.textarea}
        />
      </div>
    </div>
  );
}
