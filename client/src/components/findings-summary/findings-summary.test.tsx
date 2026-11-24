import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { FindingRecord, ReviewRecord } from "@devdigest/shared";
import { FindingsHoverCard } from "./FindingsHoverCard";
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

describe("FindingsHoverCard scrolling", () => {
  const f = {
    id: "f1", severity: "WARNING", category: "perf", title: "N+1 query", file: "a.ts", start_line: 1,
    end_line: 2, rationale: "r", suggestion: null, confidence: 0.9, kind: "finding",
    trifecta_components: null, evidence: null, review_id: "r1", accepted_at: null, dismissed_at: null,
  } as FindingRecord;

  function open() {
    render(
      <FindingsHoverCard label="1 finding" findings={[f]}>
        <span>trigger</span>
      </FindingsHoverCard>,
    );
    fireEvent.mouseEnter(screen.getByText("trigger"));
    return screen.getByRole("tooltip");
  }

  it("stays open when the card itself scrolls, closes when the page scrolls", () => {
    const card = open();
    fireEvent.scroll(card);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("does not let the wheel chain to the page at the card's edge", () => {
    const card = open();
    const wheel = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
    card.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
  });
});
