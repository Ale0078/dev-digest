import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, PrFile, ReviewRecord, SmartDiffResponse } from "@devdigest/shared";
import prReview from "../../../../../../../../messages/en/prReview.json";
import shell from "../../../../../../../../messages/en/shell.json";

const mutate = vi.fn();
const state: {
  reviews: ReviewRecord[] | undefined;
  comments: unknown[];
  smart: { data?: SmartDiffResponse; isError: boolean };
} = { reviews: [], comments: [], smart: { isError: false } };

vi.mock("@/lib/hooks/reviews", () => ({
  usePrComments: () => ({ data: state.comments }),
  useCreatePrComment: () => ({ isPending: false, mutateAsync: vi.fn() }),
  usePrReviews: () => ({ data: state.reviews }),
  useFindingAction: () => ({ isPending: false, mutate }),
}));
vi.mock("@/lib/hooks/smart-diff", () => ({ useSmartDiff: () => state.smart }));
vi.mock("@/lib/toast", () => ({ notify: { error: vi.fn() } }));

import { DiffTab } from "./DiffTab";

afterEach(cleanup);
beforeEach(() => {
  mutate.mockReset();
  state.reviews = [];
  state.comments = [];
  state.smart = { data: SMART, isError: false };
});

const PATCH = "@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: 1,\n   redisUrl: x,";
const file = (path: string): PrFile => ({ path, additions: 1, deletions: 0, patch: PATCH }) as PrFile;
const FILES = [file("pnpm-lock.yaml"), file("src/config.ts")];
const sf = (path: string) => ({ path, additions: 1, deletions: 0, finding_lines: [] as number[] });
const SMART: SmartDiffResponse = {
  groups: [
    { role: "core", files: [sf("src/config.ts")] },
    { role: "tests", files: [] },
    { role: "wiring", files: [] },
    { role: "docs", files: [] },
    { role: "boilerplate", files: [sf("pnpm-lock.yaml")] },
  ],
  split_suggestion: { too_big: false, total_lines: 2, proposed_splits: [] },
};

const FINDING: FindingRecord = {
  id: "f1",
  severity: "CRITICAL",
  category: "security",
  title: "Hardcoded Stripe secret key",
  file: "src/config.ts",
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
} as FindingRecord;

const review = (findings: FindingRecord[]): ReviewRecord =>
  ({
    id: "r1",
    pr_id: "p1",
    agent_id: "a1",
    run_id: null,
    kind: "review",
    verdict: null,
    summary: null,
    score: null,
    model: null,
    created_at: "2026-11-01T00:00:00Z",
    findings,
  }) as ReviewRecord;

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ prReview, shell }}>
      {children}
    </NextIntlClientProvider>
  );
}
const renderTab = () =>
  render(<DiffTab prId="p1" filesCount={2} files={FILES} repoFullName="acme/x" headSha="abc" />, {
    wrapper: Providers,
  });

describe("DiffTab", () => {
  it("smart order shows the lock file under Boilerplate (collapsed)", () => {
    renderTab();
    expect(screen.getByRole("button", { name: /Boilerplate/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /Core/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("pnpm-lock.yaml")).toBeNull();
    expect(screen.getByText("src/config.ts")).toBeInTheDocument();
  });

  it("original order is a flat list in files order with no headers", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Original order" }));
    expect(screen.queryByRole("button", { name: /Boilerplate/ })).toBeNull();
    const paths = screen.getAllByText(/^(pnpm-lock\.yaml|src\/config\.ts)$/).map((e) => e.textContent);
    expect(paths).toEqual(["pnpm-lock.yaml", "src/config.ts"]);
  });

  it("shows 'Review not run yet' when there are no reviews", () => {
    renderTab();
    expect(screen.getAllByText("Review not run yet").length).toBeGreaterThan(0);
  });

  it("falls back to the flat list when smart-diff errors", () => {
    state.smart = { data: undefined, isError: true };
    renderTab();
    expect(screen.queryByRole("button", { name: /Core/ })).toBeNull();
    expect(screen.getByText("pnpm-lock.yaml")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts")).toBeInTheDocument();
  });

  it("starts with findings shown and the toggle hides them together with comments", () => {
    state.reviews = [review([FINDING])];
    state.comments = [
      {
        id: 1,
        path: "src/config.ts",
        line: 10,
        original_line: 10,
        side: "RIGHT",
        body: "Human review comment",
        user: "octocat",
        created_at: "2026-11-01T00:00:00Z",
        html_url: "https://github.com/acme/x/pull/1#discussion_r1",
        in_reply_to_id: null,
        is_outdated: false,
      },
    ];
    renderTab();
    expect(screen.getByText("● 1")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
    expect(screen.getByText("Human review comment")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hide comments and findings/ }));
    expect(screen.queryByText("Hardcoded Stripe secret key")).toBeNull();
    expect(screen.queryByText("Human review comment")).toBeNull();
    expect(screen.getByRole("img", { name: "Has findings" })).toBeInTheDocument();
  });

  it("Accept calls mutate with the finding id, action and prId", () => {
    state.reviews = [review([FINDING])];
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(mutate).toHaveBeenCalledWith({ findingId: "f1", action: "accept", prId: "p1" });
  });
});
