import { describe, it, expect } from "vitest";
import type { FindingRecord } from "@devdigest/shared";
import { findingsByFile, partitionFindings, topSeverity } from "./findings";
import { keysForLine } from "./comments";
import { parsePatch } from "./helpers";

function f(over: Partial<FindingRecord>): FindingRecord {
  return {
    id: "f1",
    severity: "WARNING",
    category: "bug",
    title: "t",
    file: "src/a.ts",
    start_line: 11,
    end_line: 11,
    rationale: "r",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...over,
  } as FindingRecord;
}

const PATCH = "@@ -10,3 +10,3 @@\n ctx\n-removed\n+added\n tail";

function keysOf(patch: string): Set<string> {
  const keys = new Set<string>();
  for (const ln of parsePatch(patch)) for (const k of keysForLine(ln)) keys.add(k);
  return keys;
}

describe("findingsByFile", () => {
  it("groups by path and keeps input order", () => {
    const m = findingsByFile([f({ id: "a" }), f({ id: "b", file: "src/b.ts" }), f({ id: "c" })]);
    expect(m.get("src/a.ts")!.map((x) => x.id)).toEqual(["a", "c"]);
    expect(m.get("src/b.ts")!.map((x) => x.id)).toEqual(["b"]);
  });
});

describe("partitionFindings", () => {
  it("matches a start line on the new side and keeps the rest as unplaced", () => {
    // new side: ctx 10, add 11, tail 12; old side: 10, del 11, 12
    const keys = keysOf(PATCH);
    const { matched, unplaced } = partitionFindings(
      [f({ id: "placed", start_line: 11 }), f({ id: "far", start_line: 999 })],
      keys,
    );
    expect(matched.get("RIGHT:11")!.map((x) => x.id)).toEqual(["placed"]);
    expect(unplaced.map((x) => x.id)).toEqual(["far"]);
  });

  it("treats a line that exists only as a deleted line as unplaced", () => {
    const keys = keysOf("@@ -5,2 +5,1 @@\n-gone\n keep");
    // old line 5 is deleted; new side only has line 5 = "keep"
    const { matched, unplaced } = partitionFindings([f({ id: "x", start_line: 6 })], keys);
    expect(matched.size).toBe(0);
    expect(unplaced.map((x) => x.id)).toEqual(["x"]);
  });
});

describe("topSeverity", () => {
  it("picks the most severe, null when empty", () => {
    expect(topSeverity([f({ severity: "SUGGESTION" }), f({ severity: "CRITICAL" })])).toBe("CRITICAL");
    expect(topSeverity([])).toBeNull();
  });
});
