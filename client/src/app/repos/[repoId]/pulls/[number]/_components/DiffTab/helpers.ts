import type { DiffGroup } from "@/components/diff-viewer";
import type { PrFile, SmartDiffResponse } from "@devdigest/shared";
import { DEFAULT_COLLAPSED_ROLES, ROLE_META } from "./constants";

/**
 * Turn the smart-diff response into viewer groups. File objects come from
 * `files` (GitHub order, carries the patch); empty groups are dropped;
 * `findingFileCount` is null until a review has run.
 * `t` resolves keys under `prReview.smartDiff`.
 */
export function buildViewGroups(
  smart: SmartDiffResponse,
  files: PrFile[],
  findingFilePaths: Set<string>,
  hasReview: boolean | undefined,
  t: (key: string) => string,
): DiffGroup[] {
  const groupOf = new Map<string, string>();
  for (const g of smart.groups) for (const f of g.files) groupOf.set(f.path, g.role);
  const out: DiffGroup[] = [];
  for (const g of smart.groups) {
    const inGroup = files.filter((f) => groupOf.get(f.path) === g.role);
    if (inGroup.length === 0) continue;
    const meta = ROLE_META[g.role];
    out.push({
      key: g.role,
      label: t(meta.labelKey),
      subtitle: t(meta.subtitleKey),
      color: meta.color,
      files: inGroup,
      findingFileCount: hasReview === true ? inGroup.filter((f) => findingFilePaths.has(f.path)).length : null,
      defaultOpen: !DEFAULT_COLLAPSED_ROLES.has(g.role),
    });
  }
  return out;
}
