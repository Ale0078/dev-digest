import type { ConventionCandidate } from "@devdigest/shared";

/**
 * Server candidates plus the dimmed snapshots of ones rejected this session
 * (already deleted on the server), highest confidence first.
 */
export function mergeWithRejected(
  candidates: ConventionCandidate[],
  rejected: ConventionCandidate[],
): ConventionCandidate[] {
  const live = new Set(candidates.map((c) => c.id));
  return [...candidates, ...rejected.filter((r) => !live.has(r.id))].sort(
    (a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id),
  );
}
