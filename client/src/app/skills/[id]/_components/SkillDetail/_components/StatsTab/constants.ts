/** Donut ring size (px). */
export const DONUT_SIZE = 130;

/** Finding category → ring colour; unknown categories cycle FALLBACK_COLORS. */
export const CATEGORY_COLOR: Record<string, string> = {
  bug: "var(--crit)",
  security: "var(--warn)",
  perf: "var(--accent)",
  style: "var(--info)",
  test: "var(--ok)",
};

export const FALLBACK_COLORS = ["var(--text-secondary)", "var(--accent-hover)", "var(--text-muted)"] as const;
