import { describe, it, expect } from "vitest";
import { makeConvention } from "../../../../../../test/conventions-fixtures";
import { buildSkillBody, isSlug } from "./helpers";

describe("isSlug", () => {
  it("accepts lowercase dash slugs only", () => {
    expect(isSlug("repo-conventions")).toBe(true);
    expect(isSlug("api2-layer")).toBe(true);
    for (const bad of ["", "Repo", "a--b", "-a", "a-", "a b", "a_b", "x".repeat(65)]) {
      expect(isSlug(bad)).toBe(false);
    }
  });
});

describe("buildSkillBody", () => {
  it("renders heading, intro and one section per convention with its evidence", () => {
    const body = buildSkillBody("repo-conventions", "acme/app", [
      makeConvention({ rule: "Use X", evidence_snippet: "x()", evidence_line_start: 5, evidence_line_end: 6 }),
    ]);
    expect(body).toBe(
      [
        "# repo-conventions",
        "",
        "House conventions detected in `acme/app`. Flag changes that violate any rule below and cite the offending `file:line`.",
        "",
        "## 1. Use X",
        "Detected in `client/src/api/index.js:5-6`:",
        "```",
        "x()",
        "```",
        "",
      ].join("\n"),
    );
  });

  it("switches the fence when the snippet contains backticks", () => {
    expect(buildSkillBody("n", "r", [makeConvention({ evidence_snippet: "```js" })])).toContain("~~~\n```js\n~~~");
  });
});
