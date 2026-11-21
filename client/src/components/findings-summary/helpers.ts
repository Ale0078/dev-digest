import type { FindingRecord, ReviewRecord, Severity } from "@devdigest/shared";

export const SEVERITIES = ["CRITICAL", "WARNING", "SUGGESTION"] as const satisfies readonly Severity[];

const ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };

export type SeverityCountMap = Record<Severity, number>;

/** Number of findings per severity (every level present, zero if none). */
export function countBySeverity(findings: FindingRecord[]): SeverityCountMap {
  const c: SeverityCountMap = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of findings) if (f.severity in c) c[f.severity] += 1;
  return c;
}

/** Findings sorted most-severe first (stable within a level). */
export function bySeverity(findings: FindingRecord[]): FindingRecord[] {
  return [...findings].sort((a, b) => (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9));
}

/**
 * Each agent's latest review (re-runs replace older ones; agent-less reviews stand
 * alone). Mirrors `latestReviewPerAgent` in server/src/modules/pulls/status.ts,
 * which computes the PR list's `findings` counts.
 */
export function latestReviewPerAgent(reviews: ReviewRecord[]): ReviewRecord[] {
  const newestFirst = reviews
    .filter((r) => r.kind === "review")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const seen = new Set<string>();
  return newestFirst.filter((r) => {
    const key = r.agent_id ?? r.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
