import type { SmartDiffRole } from "@devdigest/shared";

/** Groups that start collapsed: reviewers rarely need them first. */
export const DEFAULT_COLLAPSED_ROLES: ReadonlySet<SmartDiffRole> = new Set<SmartDiffRole>(["docs", "boilerplate"]);

/** Marker colour + i18n keys (under `prReview.smartDiff`) per role. */
export const ROLE_META: Record<SmartDiffRole, { color: string; labelKey: string; subtitleKey: string }> = {
  core: { color: "var(--accent)", labelKey: "coreLabel", subtitleKey: "coreSubtitle" },
  tests: { color: "var(--sugg)", labelKey: "testsLabel", subtitleKey: "testsSubtitle" },
  wiring: { color: "var(--warn)", labelKey: "wiringLabel", subtitleKey: "wiringSubtitle" },
  docs: { color: "var(--info)", labelKey: "docsLabel", subtitleKey: "docsSubtitle" },
  boilerplate: { color: "var(--text-muted)", labelKey: "boilerplateLabel", subtitleKey: "boilerplateSubtitle" },
};
