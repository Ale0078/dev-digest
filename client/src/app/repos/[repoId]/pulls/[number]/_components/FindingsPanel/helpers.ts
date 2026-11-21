import type { FindingRecord, Severity } from "@devdigest/shared";
import { COUNTED_SEVERITIES, LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

/** Optionally drop low-confidence findings and/or keep one severity, then sort by severity. */
export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  severity: Severity | null = null,
): FindingRecord[] {
  let shown = findings;
  if (hideLow) shown = shown.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD);
  if (severity) shown = shown.filter((f) => f.severity === severity);
  return [...shown].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}

/** Number of findings per severity level (every level present, zero if none). */
export function severityCounts(findings: FindingRecord[]): Record<Severity, number> {
  const counts = Object.fromEntries(COUNTED_SEVERITIES.map((sev) => [sev, 0])) as Record<Severity, number>;
  for (const f of findings) if (f.severity in counts) counts[f.severity] += 1;
  return counts;
}
