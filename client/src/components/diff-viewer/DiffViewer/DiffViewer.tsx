/* DiffViewer — basic GitHub-style unified diff viewer. Renders real PrFile.patch
   (unified-diff text from the F1 API) as a list of collapsible FileCards.
   Optional inline comments (Files changed tab): hover a line → "+" → comment,
   posted live to GitHub; existing GitHub review comments render inline.
   Optional Smart Diff: `groups` renders role sections instead of a flat list,
   and `findingApi` places findings under their lines. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { PrFile } from "@/lib/types";
import { type DiffCommentApi } from "../comments";
import { findingsByFile, type DiffFindingApi, type DiffGroup } from "../findings";
import { s } from "../styles";
import { FileCard } from "../FileCard";
import { GroupSection } from "../GroupSection";

export function DiffViewer({
  files,
  commenting,
  findingApi,
  groups,
}: {
  files: PrFile[];
  commenting?: DiffCommentApi;
  findingApi?: DiffFindingApi;
  groups?: DiffGroup[];
}) {
  const t = useTranslations("shell");
  const byFile = React.useMemo(() => findingsByFile(findingApi?.findings ?? []), [findingApi?.findings]);
  const card = (f: PrFile) => (
    <FileCard
      key={f.path}
      file={f}
      commenting={commenting}
      findingApi={findingApi}
      fileFindings={byFile.get(f.path)}
    />
  );
  if (!files || files.length === 0) {
    return <div style={s.empty}>{t("diffViewer.noChangedFiles")}</div>;
  }
  if (groups) {
    return (
      <div style={s.list}>
        {groups.map((g) => (
          <GroupSection key={g.key} group={g}>
            {g.files.map(card)}
          </GroupSection>
        ))}
      </div>
    );
  }
  return <div style={s.list}>{files.map(card)}</div>;
}
