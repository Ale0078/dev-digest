import type { IntentConfidence, IntentSource } from "@devdigest/shared";

/** First 7 chars of a commit sha; "—" when unknown. */
export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : "—";
}

/** Badge colours per classifier confidence. */
export function confidenceColors(c: IntentConfidence): { color: string; bg: string } {
  if (c === "high") return { color: "var(--ok)", bg: "var(--ok-bg)" };
  if (c === "medium") return { color: "var(--warn)", bg: "var(--warn-bg)" };
  return { color: "var(--text-muted)", bg: "var(--bg-hover)" };
}

/** Text colour per source availability. */
export function statusColor(status: IntentSource["status"]): string {
  if (status === "fetched") return "var(--ok)";
  if (status === "unavailable") return "var(--warn)";
  return "var(--text-muted)";
}
