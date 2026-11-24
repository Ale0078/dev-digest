import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";
import { severityCounts, visibleFindings } from "./helpers";

afterEach(cleanup);

const FINDINGS: FindingRecord[] = [
  {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  },
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

const base = FINDINGS[0]!;
const MIXED: FindingRecord[] = [
  { ...base, id: "c1", severity: "CRITICAL", title: "Crit one", confidence: 0.95 },
  { ...base, id: "w1", severity: "WARNING", title: "Warn high", confidence: 0.9 },
  { ...base, id: "w2", severity: "WARNING", title: "Warn low", confidence: 0.4 },
  { ...base, id: "s1", severity: "SUGGESTION", title: "Sugg one", confidence: 0.8 },
];
const WARN_ONLY = MIXED.filter((f) => f.severity === "WARNING");

const chip = (name: RegExp) => screen.getByRole("button", { name });
const titles = () => ["Crit one", "Warn high", "Warn low", "Sugg one"].filter((x) => screen.queryByText(x));

describe("severity helpers", () => {
  it("counts findings per severity, zero for missing levels", () => {
    expect(severityCounts(WARN_ONLY)).toEqual({ CRITICAL: 0, WARNING: 2, SUGGESTION: 0 });
    expect(severityCounts(MIXED)).toEqual({ CRITICAL: 1, WARNING: 2, SUGGESTION: 1 });
  });

  it("filters by severity together with hide-low-confidence", () => {
    expect(visibleFindings(MIXED, false, "WARNING").map((f) => f.id)).toEqual(["w1", "w2"]);
    expect(visibleFindings(MIXED, true, "WARNING").map((f) => f.id)).toEqual(["w1"]);
    expect(visibleFindings(MIXED, false).map((f) => f.id)).toEqual(["c1", "w1", "w2", "s1"]);
  });
});

describe("FindingsPanel severity filter", () => {
  it("shows a counter per level and hides empty levels", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    expect(chip(/^1 CRITICAL$/)).toBeInTheDocument();
    expect(chip(/^2 WARNING$/)).toBeInTheDocument();
    expect(chip(/^1 SUGGESTION$/)).toBeInTheDocument();
    cleanup();
    renderWithIntl(<FindingsPanel findings={WARN_ONLY} prId="pr1" />);
    expect(screen.queryByRole("button", { name: /CRITICAL/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /SUGGESTION/ })).toBeNull();
  });

  it("filters on click, moves the selection, and clears on a second click — without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);

    fireEvent.click(chip(/WARNING/));
    expect(titles()).toEqual(["Warn high", "Warn low"]);
    expect(chip(/WARNING/)).toHaveAttribute("aria-pressed", "true");
    expect(chip(/CRITICAL/)).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(chip(/CRITICAL/));
    expect(titles()).toEqual(["Crit one"]);
    expect(chip(/CRITICAL/)).toHaveAttribute("aria-pressed", "true");
    expect(chip(/WARNING/)).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(chip(/CRITICAL/));
    expect(titles()).toEqual(["Crit one", "Warn high", "Warn low", "Sugg one"]);
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("combines with hide low confidence; counters follow the toggle", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(chip(/WARNING/));
    fireEvent.click(screen.getByRole("switch"));
    expect(titles()).toEqual(["Warn high"]);
    expect(chip(/^1 WARNING$/)).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the active level and shows the empty state when nothing is left", () => {
    const lowOnly = [{ ...base, id: "w9", severity: "WARNING" as const, title: "Warn low", confidence: 0.3 }];
    renderWithIntl(<FindingsPanel findings={[...lowOnly, MIXED[0]!]} prId="pr1" />);
    fireEvent.click(chip(/WARNING/));
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("No findings match")).toBeInTheDocument();
    fireEvent.click(chip(/^0 WARNING$/));
    expect(titles()).toEqual(["Crit one"]);
  });

  it("recounts when findings change (e.g. after accept/dismiss refetch)", () => {
    const { rerender } = renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    rerender(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <FindingsPanel findings={MIXED.filter((f) => f.id !== "w2")} prId="pr1" />
      </NextIntlClientProvider>,
    );
    expect(chip(/^1 WARNING$/)).toBeInTheDocument();
  });
});
