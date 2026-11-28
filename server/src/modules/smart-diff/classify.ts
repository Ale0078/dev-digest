import type { SmartDiff, SmartDiffGroup, SmartDiffRole } from '@devdigest/shared';
import { CLASSIFY_RULES, SMART_DIFF_ROLE_ORDER, type PathParts } from './constants.js';

/** `\` → `/` and a leading `./` stripped. */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function parts(path: string): PathParts {
  const segments = normalizePath(path).split('/');
  return { segments, dirs: segments.slice(0, -1), base: segments[segments.length - 1] ?? '' };
}

export function classifyFile(path: string): SmartDiffRole {
  const p = parts(path);
  for (const rule of CLASSIFY_RULES) {
    if (rule.matchers.some((m) => m(p))) return rule.role;
  }
  return 'core';
}

export interface SmartDiffInputFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface SmartDiffInputFinding {
  file: string;
  start_line: number;
}

/**
 * Group files by role (always all five groups, in display order), keeping input
 * order inside a group. `finding_lines` are the sorted, unique start lines of
 * the findings on that file.
 */
export function buildSmartDiff(files: SmartDiffInputFile[], findings: SmartDiffInputFinding[]): SmartDiff {
  const linesByFile = new Map<string, Set<number>>();
  for (const f of findings) {
    const key = normalizePath(f.file);
    const set = linesByFile.get(key) ?? new Set<number>();
    set.add(f.start_line);
    linesByFile.set(key, set);
  }

  const groups: SmartDiffGroup[] = SMART_DIFF_ROLE_ORDER.map((role) => ({ role, files: [] }));
  const byRole = new Map(groups.map((g) => [g.role, g]));
  let totalLines = 0;
  for (const f of files) {
    totalLines += f.additions + f.deletions;
    byRole.get(classifyFile(f.path))!.files.push({
      path: f.path,
      pseudocode_summary: null,
      additions: f.additions,
      deletions: f.deletions,
      finding_lines: [...(linesByFile.get(normalizePath(f.path)) ?? [])].sort((a, b) => a - b),
    });
  }

  return {
    groups,
    split_suggestion: { too_big: false, total_lines: totalLines, proposed_splits: [] },
  };
}
