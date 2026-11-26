import { describe, it, expect } from "vitest";
import { hasChanges, lineDiff } from "./helpers";

describe("lineDiff", () => {
  it("marks identical text as all-same", () => {
    const d = lineDiff("a\nb", "a\nb");
    expect(d).toEqual([
      { kind: "same", text: "a" },
      { kind: "same", text: "b" },
    ]);
    expect(hasChanges(d)).toBe(false);
  });

  it("finds a changed middle line, deletion first", () => {
    expect(lineDiff("a\nb\nc", "a\nB\nc")).toEqual([
      { kind: "same", text: "a" },
      { kind: "del", text: "b" },
      { kind: "add", text: "B" },
      { kind: "same", text: "c" },
    ]);
  });

  it("handles pure insertions and trailing deletions", () => {
    expect(lineDiff("a\nc", "a\nb\nc")).toEqual([
      { kind: "same", text: "a" },
      { kind: "add", text: "b" },
      { kind: "same", text: "c" },
    ]);
    expect(lineDiff("a\nb\nc", "a")).toEqual([
      { kind: "same", text: "a" },
      { kind: "del", text: "b" },
      { kind: "del", text: "c" },
    ]);
  });

  it("keeps the longest common subsequence", () => {
    const d = lineDiff("x\na\nb\nc", "a\nb\nc\ny");
    expect(d.filter((l) => l.kind === "same").map((l) => l.text)).toEqual(["a", "b", "c"]);
    expect(d.filter((l) => l.kind === "del").map((l) => l.text)).toEqual(["x"]);
    expect(d.filter((l) => l.kind === "add").map((l) => l.text)).toEqual(["y"]);
  });
});
