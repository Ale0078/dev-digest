import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, within } from "@testing-library/react";
import { makeSkill, renderWithIntl } from "../../../../../test/skills-fixtures";

const updateMutate = vi.fn();
const deleteMutate = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("../../../../../lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate: updateMutate, isPending: false }),
  useDeleteSkill: () => ({ mutate: deleteMutate, isPending: false }),
  useSkillStats: (_id: string, opts?: { enabled?: boolean }) => ({
    isLoading: false,
    data:
      opts?.enabled === false
        ? undefined
        : { used_by: 1, pull_rate: null, accept_rate: null, findings_30d: 0, agents: [{ id: "ag1", name: "Test Quality Reviewer" }], by_category: [] },
  }),
  useSkillTokenCount: (text: string) => ({ data: text.length }),
  useSkillVersions: () => ({ data: [], isLoading: false, isError: false }),
  useRestoreSkillVersion: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { SkillDetail } from "./SkillDetail";

beforeEach(() => {
  updateMutate.mockReset();
  deleteMutate.mockReset();
});
afterEach(cleanup);

describe("SkillDetail · Config", () => {
  it("shows header badges, filename and live token count; unsaved badge only when dirty", () => {
    const skill = makeSkill();
    renderWithIntl(<SkillDetail skill={skill} tab="config" onTab={() => {}} />);
    expect(screen.getByRole("heading", { name: "branch-coverage-gate" })).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("branch-coverage-gate.md")).toBeInTheDocument();
    expect(screen.getByText("Write it as a directive: when the agent should apply this skill and what it must do")).toBeInTheDocument();
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
    const block = `### ${skill.name}\n${skill.description}\n\n${skill.body}`;
    expect(screen.getByTestId("body-tokens")).toHaveTextContent(`${block.length} tokens`);

    fireEvent.change(screen.getByLabelText("Skill body"), { target: { value: "new body" } });
    expect(screen.getByText("unsaved")).toBeInTheDocument();
  });

  it("saves only the changed fields plus the change note", () => {
    renderWithIntl(<SkillDetail skill={makeSkill()} tab="config" onTab={() => {}} />);
    const save = screen.getByText("Save skill").closest("button")!;
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Skill body"), { target: { value: "- stricter rule" } });
    fireEvent.change(screen.getByLabelText("Change note"), { target: { value: "tighten wording" } });
    fireEvent.click(save);
    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0]?.[0]).toEqual({
      id: "sk1",
      patch: { body: "- stricter rule", message: "tighten wording" },
    });
  });

  it("saves a change note alone (annotates the current version)", () => {
    renderWithIntl(<SkillDetail skill={makeSkill()} tab="config" onTab={() => {}} />);
    const save = screen.getByText("Save skill").closest("button")!;
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Change note"), { target: { value: "clarify intent" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(updateMutate.mock.calls.at(-1)?.[0]).toEqual({ id: "sk1", patch: { message: "clarify intent" } });
  });

  it("toggles enabled immediately without a content save", () => {
    renderWithIntl(<SkillDetail skill={makeSkill()} tab="config" onTab={() => {}} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(updateMutate.mock.calls[0]?.[0]).toEqual({ id: "sk1", patch: { enabled: false } });
  });

  it("shows the trust banner for imported skills", () => {
    renderWithIntl(<SkillDetail skill={makeSkill({ source: "imported", enabled: false })} tab="config" onTab={() => {}} />);
    expect(screen.getByText("Imported skill — someone else's instructions")).toBeInTheDocument();
    expect(screen.getByText("Imported")).toBeInTheDocument();
  });
});

describe("SkillDetail · Preview", () => {
  it("renders the skill block from unsaved edits", () => {
    const { rerender } = renderWithIntl(<SkillDetail skill={makeSkill()} tab="config" onTab={() => {}} />);
    fireEvent.change(screen.getByLabelText("Skill body"), { target: { value: "**bold rule**" } });
    rerender(<SkillDetail skill={makeSkill()} tab="preview" onTab={() => {}} />);
    const preview = screen.getByTestId("skill-preview");
    expect(within(preview).getByRole("heading", { level: 3, name: "branch-coverage-gate" })).toBeInTheDocument();
    expect(within(preview).getByText("Every new branch needs an asserting test.")).toBeInTheDocument();
    expect(within(preview).getByText("bold rule").tagName).toBe("STRONG");
  });
});

describe("SkillDetail · Delete", () => {
  it("lists affected agents and deletes on confirm", () => {
    renderWithIntl(<SkillDetail skill={makeSkill()} tab="config" onTab={() => {}} />);
    fireEvent.click(screen.getByText("Delete"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Test Quality Reviewer")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByText("Delete skill"));
    expect(deleteMutate).toHaveBeenCalledWith("sk1", expect.anything());
  });
});
