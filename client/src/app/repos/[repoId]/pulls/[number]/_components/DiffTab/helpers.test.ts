import { describe, it, expect } from "vitest";
import type { PrFile, SmartDiffResponse } from "@devdigest/shared";
import { buildViewGroups } from "./helpers";

const file = (path: string): PrFile => ({ path, additions: 1, deletions: 0, patch: null }) as PrFile;
const sf = (path: string) => ({ path, additions: 1, deletions: 0, finding_lines: [] as number[] });

const SMART: SmartDiffResponse = {
  groups: [
    { role: "core", files: [sf("src/a.ts"), sf("src/b.ts")] },
    { role: "tests", files: [] },
    { role: "wiring", files: [] },
    { role: "docs", files: [sf("README.md")] },
    { role: "boilerplate", files: [sf("pnpm-lock.yaml")] },
  ],
  split_suggestion: { too_big: false, total_lines: 4, proposed_splits: [] },
};
// GitHub order differs from group order
const FILES = [file("pnpm-lock.yaml"), file("src/b.ts"), file("README.md"), file("src/a.ts")];
const t = (k: string) => k;

describe("buildViewGroups", () => {
  it("drops empty groups and keeps GitHub order inside a group", () => {
    const g = buildViewGroups(SMART, FILES, new Set(), true, t);
    expect(g.map((x) => x.key)).toEqual(["core", "docs", "boilerplate"]);
    expect(g[0]!.files.map((f) => f.path)).toEqual(["src/b.ts", "src/a.ts"]);
  });

  it("collapses docs and boilerplate by default", () => {
    const g = buildViewGroups(SMART, FILES, new Set(), true, t);
    expect(g.map((x) => [x.key, x.defaultOpen])).toEqual([
      ["core", true],
      ["docs", false],
      ["boilerplate", false],
    ]);
  });

  it("counts files with findings per group", () => {
    const g = buildViewGroups(SMART, FILES, new Set(["src/a.ts", "README.md"]), true, t);
    expect(g.map((x) => x.findingFileCount)).toEqual([1, 1, 0]);
  });

  it("uses null counts when no review has run (or it is unknown)", () => {
    expect(buildViewGroups(SMART, FILES, new Set(["src/a.ts"]), false, t).every((x) => x.findingFileCount === null)).toBe(true);
    expect(buildViewGroups(SMART, FILES, new Set(), undefined, t).every((x) => x.findingFileCount === null)).toBe(true);
  });
});
