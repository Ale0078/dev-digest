import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, within } from "@testing-library/react";
import type { SkillVersion } from "@devdigest/shared";
import { makeSkill, renderWithIntl } from "../../../../../../../test/skills-fixtures";

const VERSIONS: SkillVersion[] = [
  { skill_id: "sk1", version: 3, body: "a\nB\nc", message: "tighten", created_at: "2026-11-22T10:00:00Z" },
  { skill_id: "sk1", version: 2, body: "a\nb\nc", message: null, created_at: "2026-11-21T10:00:00Z" },
  { skill_id: "sk1", version: 1, body: "a\nb\nc", message: "Initial", created_at: "2026-11-20T10:00:00Z" },
];
const restoreMutate = vi.fn();

vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkillVersions: () => ({ data: VERSIONS, isLoading: false, isError: false }),
  useRestoreSkillVersion: () => ({ mutate: restoreMutate, isPending: false }),
}));

import { VersionsTab } from "./VersionsTab";

beforeEach(() => restoreMutate.mockReset());
afterEach(cleanup);

const SKILL = makeSkill({ version: 3, body: "a\nB\nc" });

describe("VersionsTab", () => {
  it("lists versions with the Current badge on the latest and no actions on it", () => {
    renderWithIntl(<VersionsTab skill={SKILL} />);
    const current = screen.getByTestId("version-3");
    expect(within(current).getByText("Current")).toBeInTheDocument();
    expect(within(current).getByText("tighten")).toBeInTheDocument();
    expect(within(current).queryByText("Restore")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("version-2")).getByText("No message")).toBeInTheDocument();
  });

  it("diffs an old version against the current body", () => {
    renderWithIntl(<VersionsTab skill={SKILL} />);
    fireEvent.click(within(screen.getByTestId("version-2")).getByText("Diff"));
    const diff = screen.getByTestId("version-diff");
    const lines = Array.from(diff.querySelectorAll("[data-kind]")).map((el) => el.getAttribute("data-kind"));
    expect(lines).toEqual(["same", "del", "add", "same"]);
    expect(screen.getByText("v2 → current (v3)")).toBeInTheDocument();
  });

  it("asks for confirmation before restoring, then restores that version", () => {
    renderWithIntl(<VersionsTab skill={SKILL} />);
    fireEvent.click(within(screen.getByTestId("version-1")).getByText("Restore"));
    expect(restoreMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("This creates a new version (v4) with v1's content. History is kept.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Restore" }));
    expect(restoreMutate).toHaveBeenCalledWith({ id: "sk1", version: 1 }, expect.anything());
  });

  it("cancel closes the confirm without restoring", () => {
    renderWithIntl(<VersionsTab skill={SKILL} />);
    fireEvent.click(within(screen.getByTestId("version-1")).getByText("Restore"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(restoreMutate).not.toHaveBeenCalled();
  });
});
