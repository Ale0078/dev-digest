import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReviewRecord } from "@devdigest/shared";
import { SeverityCountIcons } from "./SeverityCountIcons";
import { latestReviewPerAgent } from "./helpers";

afterEach(cleanup);

describe("SeverityCountIcons", () => {
  it("renders only non-zero levels, nothing when all are zero", () => {
    render(<SeverityCountIcons counts={{ CRITICAL: 2, WARNING: 0, SUGGESTION: 1 }} />);
    expect(screen.getByLabelText("2 Critical")).toBeInTheDocument();
    expect(screen.getByLabelText("1 Suggestion")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Warning/)).toBeNull();
    cleanup();
    const { container } = render(<SeverityCountIcons counts={{ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("latestReviewPerAgent", () => {
  const rv = (id: string, agent_id: string | null, created_at: string, kind: "review" | "summary" = "review") =>
    ({ id, agent_id, created_at, kind, findings: [] }) as unknown as ReviewRecord;

  it("keeps the newest review per agent and drops summaries", () => {
    const out = latestReviewPerAgent([
      rv("old-gen", "gen", "2026-11-21T17:05:00Z"),
      rv("new-gen", "gen", "2026-11-21T17:17:00Z"),
      rv("sec", "sec", "2026-11-21T17:17:00Z"),
      rv("sum", null, "2026-11-21T17:20:00Z", "summary"),
    ]);
    expect(out.map((r) => r.id).sort()).toEqual(["new-gen", "sec"]);
  });
});
