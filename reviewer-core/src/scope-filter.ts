import type { Finding } from '@devdigest/shared';

/**
 * Deterministic post-grounding scope filter. Pure.
 *
 * The model tags each finding `scope: "in_scope" | "out_of_scope"` when an intent was injected.
 * This filter then:
 *  1. keeps every finding that is not tagged `out_of_scope`;
 *  2. drops out-of-scope findings that are not serious;
 *  3. keeps exactly ONE serious out-of-scope finding (the worst, deterministic pick) and
 *     collapses the rest into it.
 * Serious = CRITICAL severity OR security category. The model's tag can narrow the review, but a
 * real serious defect is never silently lost.
 */

export interface ScopeFilterResult {
  kept: Finding[];
  dropped: { finding: Finding; reason: string }[];
}

const SEVERITY_RANK: Record<Finding['severity'], number> = {
  CRITICAL: 0,
  WARNING: 1,
  SUGGESTION: 2,
};

export function isSeriousFinding(f: Finding): boolean {
  return f.severity === 'CRITICAL' || f.category === 'security';
}

function compareSerious(a: Finding, b: Finding): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    b.confidence - a.confidence ||
    a.file.localeCompare(b.file) ||
    a.start_line - b.start_line ||
    a.title.localeCompare(b.title)
  );
}

export function applyScopeFilter(findings: Finding[]): ScopeFilterResult {
  const dropped: ScopeFilterResult['dropped'] = [];
  const serious: Finding[] = [];
  for (const f of findings) {
    if (f.scope !== 'out_of_scope') continue;
    if (isSeriousFinding(f)) serious.push(f);
    else dropped.push({ finding: f, reason: 'out of PR scope' });
  }
  if (dropped.length === 0 && serious.length === 0) return { kept: findings, dropped };

  const sorted = [...serious].sort(compareSerious);
  const keeper = sorted[0];
  const collapsed = sorted.slice(1);
  for (const f of collapsed) {
    dropped.push({ finding: f, reason: 'collapsed into one out-of-scope signal' });
  }
  const droppedSet = new Set(dropped.map((d) => d.finding));
  const kept: Finding[] = [];
  for (const f of findings) {
    if (droppedSet.has(f)) continue;
    if (keeper && f === keeper) {
      const note =
        collapsed.length > 0
          ? `\n\n_Outside this PR's stated scope; ${collapsed.length} more serious out-of-scope issue(s) collapsed._`
          : `\n\n_Outside this PR's stated scope._`;
      kept.push({ ...f, rationale: f.rationale + note });
    } else {
      kept.push(f);
    }
  }
  return { kept, dropped };
}
