import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { ConventionCandidate, Repo } from "@devdigest/shared";
import { makeConvention, renderWithIntl } from "../../../../../../test/conventions-fixtures";

const state = {
  list: { data: [] as ConventionCandidate[] | undefined, isLoading: false, isError: false, error: null as Error | null },
  extract: { isPending: false, isError: false, isSuccess: false, error: null as Error | null, data: undefined as unknown },
};
const extractMutate = vi.fn();
const updateMutateAsync = vi.fn();
const rejectMutateAsync = vi.fn();
const refetch = vi.fn();

vi.mock("@/lib/hooks/conventions", () => ({
  useConventions: () => ({ ...state.list, refetch }),
  useExtractConventions: () => ({ ...state.extract, mutate: extractMutate }),
  useUpdateConvention: () => ({ mutateAsync: updateMutateAsync }),
  useRejectConvention: () => ({ mutateAsync: rejectMutateAsync }),
  useCreateConventionSkill: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));
vi.mock("@/lib/hooks/skills", () => ({ useSkillTokenCount: () => ({ data: 1 }) }));

import { ConventionsView } from "./ConventionsView";

const REPO = { id: "r1", full_name: "acme/app", default_branch: "main" } as Repo;

beforeEach(() => {
  state.list = { data: [], isLoading: false, isError: false, error: null };
  state.extract = { isPending: false, isError: false, isSuccess: false, error: null, data: undefined };
  extractMutate.mockReset();
  updateMutateAsync.mockReset().mockResolvedValue({});
  rejectMutateAsync.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("ConventionsView", () => {
  it("shows the empty state until extraction has run, and starts it", () => {
    renderWithIntl(<ConventionsView repoId="r1" repo={REPO} />);
    expect(screen.getByText("Conventions in acme/app")).toBeTruthy();
    expect(screen.getByText("No conventions extracted yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Run extraction" }));
    expect(extractMutate).toHaveBeenCalledTimes(1);
  });

  it("shows a clear error when extraction fails", () => {
    state.extract = {
      ...state.extract,
      isError: true,
      error: new Error("The repo is not cloned yet — sync it before extracting conventions"),
    };
    renderWithIntl(<ConventionsView repoId="r1" repo={REPO} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Extraction failed");
    expect(alert.textContent).toContain("not cloned yet");
  });

  it("lists candidates with an accepted counter and GitHub evidence links", () => {
    state.list.data = [
      makeConvention({ id: "a", rule: "Rule A", accepted: true, confidence: 0.9 }),
      makeConvention({ id: "b", rule: "Rule B" }),
    ];
    renderWithIntl(<ConventionsView repoId="r1" repo={REPO} />);
    expect(screen.getByText("1 of 2 accepted")).toBeTruthy();
    expect(screen.getAllByTestId("convention-card")).toHaveLength(2);
    expect(
      screen.getAllByRole("link")[0]!.getAttribute("href"),
    ).toBe("https://github.com/acme/app/blob/main/client/src/api/index.js#L3-L4");
    fireEvent.click(screen.getByRole("button", { name: "Re-scan" }));
    expect(extractMutate).toHaveBeenCalledTimes(1);
  });

  it("accepts via PATCH and keeps a rejected card visible as Rejected", async () => {
    state.list.data = [makeConvention({ id: "b", rule: "Rule B" })];
    const { rerender } = renderWithIntl(<ConventionsView repoId="r1" repo={REPO} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(updateMutateAsync).toHaveBeenCalledWith({ id: "b", patch: { accepted: true } });
    // The card is busy until the PATCH settles.
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(false),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(rejectMutateAsync).toHaveBeenCalledWith("b");
    state.list.data = []; // the server deleted it
    await waitFor(() => {
      rerender(<ConventionsView repoId="r1" repo={REPO} />);
      expect(screen.getByTestId("convention-card").getAttribute("data-status")).toBe("rejected");
    });
  });

  it("disables Create skill until something is accepted, then opens the modal", () => {
    state.list.data = [makeConvention({ id: "b" })];
    const { rerender } = renderWithIntl(<ConventionsView repoId="r1" repo={REPO} />);
    expect((screen.getByRole("button", { name: "Create skill" }) as HTMLButtonElement).disabled).toBe(true);
    state.list.data = [makeConvention({ id: "b", accepted: true })];
    rerender(<ConventionsView repoId="r1" repo={REPO} />);
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(screen.getByText("Create skill from conventions")).toBeTruthy();
  });
});
