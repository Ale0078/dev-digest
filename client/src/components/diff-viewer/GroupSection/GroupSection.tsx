/* GroupSection — one role group of the Smart Diff view: a sticky header
   (chevron, colour square, label, subtitle, files-with-findings counter, file
   count) and, when open, its file cards. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { DiffGroup } from "../findings";
import { s, chevronFor, groupSquareStyle } from "../styles";

export function GroupSection({ group, children }: { group: DiffGroup; children: React.ReactNode }) {
  const t = useTranslations("prReview");
  const [open, setOpen] = React.useState(group.defaultOpen);
  const n = group.findingFileCount;
  return (
    <section style={s.groupWrap}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={s.groupHeader}>
        <Icon.ChevronRight size={13} style={chevronFor(open)} />
        <span aria-hidden style={groupSquareStyle(group.color)} />
        <span style={s.groupLabel}>{group.label}</span>
        <span style={s.groupSubtitle}>{group.subtitle}</span>
        <span style={{ flex: 1 }} />
        {n === null ? (
          <span style={s.groupHint}>{t("smartDiff.noReviewYet")}</span>
        ) : n > 0 ? (
          <span style={s.groupCount} title={t("smartDiff.filesWithFindings", { count: n })}>
            ● {n}
          </span>
        ) : null}
        <span style={s.groupHint}>{t("smartDiff.filesCount", { count: group.files.length })}</span>
      </button>
      {open && <div style={s.list}>{children}</div>}
    </section>
  );
}
