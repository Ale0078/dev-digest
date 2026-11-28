/* Inline-finding support for the DiffViewer (Files changed tab, Smart Diff).
   Pure helpers + the API shape the viewer needs. The viewer stays generic:
   the finding card itself is injected through `renderFinding`. */
import type { ReactNode } from "react";
import type { FindingRecord } from "@devdigest/shared";
import type { PrFile } from "@/lib/types";
import { lineKey } from "./comments";

/** What the viewer needs to place findings under their diff lines. */
export interface DiffFindingApi {
  findings: FindingRecord[];
  /** When false, the finding cards are hidden (the dot, stripe and severity word stay). */
  show: boolean;
  /** Called inside JSX; the viewer wraps the result in a keyed Fragment. */
  renderFinding: (f: FindingRecord) => ReactNode;
}

/** One role group of the Smart Diff view. */
export interface DiffGroup {
  key: string;
  label: string;
  subtitle: string;
  /** CSS colour of the group's marker square. */
  color: string;
  files: PrFile[];
  /** Files in the group with findings; null when no review has run yet. */
  findingFileCount: number | null;
  defaultOpen: boolean;
}

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };

/** Findings indexed by file path (input order kept). */
export function findingsByFile(findings: FindingRecord[]): Map<string, FindingRecord[]> {
  const out = new Map<string, FindingRecord[]>();
  for (const f of findings) {
    const list = out.get(f.file) ?? [];
    list.push(f);
    out.set(f.file, list);
  }
  return out;
}

/** The most severe severity among the findings (unknown severities sort last). */
export function topSeverity(findings: FindingRecord[]): FindingRecord["severity"] | null {
  let best: FindingRecord | null = null;
  for (const f of findings) {
    if (!best || (SEVERITY_RANK[f.severity] ?? 9) < (SEVERITY_RANK[best.severity] ?? 9)) best = f;
  }
  return best ? best.severity : null;
}

/**
 * Split one file's findings into those whose start line is rendered on the
 * new side (`RIGHT:<start_line>`) and "unplaced" ones (line not in the patch,
 * or only a deleted line). Nothing is dropped.
 */
export function partitionFindings(
  fileFindings: FindingRecord[],
  renderedKeys: Set<string>,
): { matched: Map<string, FindingRecord[]>; unplaced: FindingRecord[] } {
  const matched = new Map<string, FindingRecord[]>();
  const unplaced: FindingRecord[] = [];
  for (const f of fileFindings) {
    const key = lineKey("RIGHT", f.start_line);
    if (key && renderedKeys.has(key)) {
      const list = matched.get(key) ?? [];
      list.push(f);
      matched.set(key, list);
    } else {
      unplaced.push(f);
    }
  }
  return { matched, unplaced };
}
