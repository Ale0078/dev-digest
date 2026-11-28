/* UnplacedFindings — end-of-file block for findings whose line is not in the
   rendered patch, so no finding is silently dropped. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import { cs } from "../comments";
import type { DiffFindingApi } from "../findings";

export function UnplacedFindings({
  findings,
  renderFinding,
}: {
  findings: FindingRecord[];
  renderFinding: DiffFindingApi["renderFinding"];
}) {
  const t = useTranslations("prReview");
  if (findings.length === 0) return null;
  return (
    <div style={cs.outdatedWrap}>
      <span style={cs.outdatedTitle}>{t("smartDiff.unplacedFindings", { count: findings.length })}</span>
      {findings.map((f) => (
        <React.Fragment key={f.id}>{renderFinding(f)}</React.Fragment>
      ))}
    </div>
  );
}
