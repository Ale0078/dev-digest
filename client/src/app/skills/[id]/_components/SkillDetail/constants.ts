import type { IconName } from "@devdigest/ui";

/** Detail tab keys, kept in `?tab=`. Evals is out of scope for M2. */
export const DETAIL_TAB_KEYS = ["config", "preview", "stats", "versions"] as const;
export type DetailTab = (typeof DETAIL_TAB_KEYS)[number];

export const DETAIL_TABS: readonly { key: DetailTab; labelKey: string; icon: IconName }[] = [
  { key: "config", labelKey: "detail.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "detail.tabs.preview", icon: "Eye" },
  { key: "stats", labelKey: "detail.tabs.stats", icon: "BarChart" },
  { key: "versions", labelKey: "detail.tabs.versions", icon: "History" },
];

/** Narrow a `?tab=` value; anything unknown falls back to Config. */
export function toDetailTab(v: string | null | undefined): DetailTab {
  return (DETAIL_TAB_KEYS as readonly string[]).includes(v ?? "") ? (v as DetailTab) : "config";
}
