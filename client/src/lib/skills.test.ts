import { describe, it, expect } from "vitest";
import { formatRate, isImportedSource, renderSkillBlock, skillFilename, sourceBadgeKey } from "./skills";

describe("renderSkillBlock", () => {
  it("is byte-identical to reviewer-core's block format", () => {
    expect(
      renderSkillBlock({ name: "branch-coverage-gate", description: "Apply to new branches.", body: "- rule 1\n- rule 2" }),
    ).toBe("### branch-coverage-gate\nApply to new branches.\n\n- rule 1\n- rule 2");
  });

  it("keeps an empty description line (no trimming)", () => {
    expect(renderSkillBlock({ name: "x", description: "", body: "b" })).toBe("### x\n\n\nb");
  });
});

describe("skill display helpers", () => {
  it("maps both imported sources to the Imported badge", () => {
    expect(sourceBadgeKey("imported")).toBe("imported");
    expect(sourceBadgeKey("imported_url")).toBe("imported");
    expect(sourceBadgeKey("manual")).toBe("manual");
    expect(isImportedSource("imported_url")).toBe(true);
    expect(isImportedSource("community")).toBe(false);
  });

  it("formats rates and shows — for missing data", () => {
    expect(formatRate(0.426)).toBe("43%");
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(null)).toBe("—");
  });

  it("builds the editor filename", () => {
    expect(skillFilename("mocking-smells")).toBe("mocking-smells.md");
    expect(skillFilename("  ")).toBe("untitled.md");
  });
});
