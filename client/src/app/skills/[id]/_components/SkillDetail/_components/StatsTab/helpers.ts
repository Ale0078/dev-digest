import type { DonutSegment } from "@devdigest/ui";
import type { SkillStats } from "@devdigest/shared";
import { CATEGORY_COLOR, FALLBACK_COLORS } from "./constants";

/** by_category → donut segments, biggest first, zero counts dropped. */
export function categorySegments(byCategory: SkillStats["by_category"]): DonutSegment[] {
  let fallback = 0;
  return byCategory
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((c) => ({
      label: c.category,
      value: c.count,
      color: CATEGORY_COLOR[c.category] ?? FALLBACK_COLORS[fallback++ % FALLBACK_COLORS.length] ?? "var(--text-muted)",
    }));
}
