import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, within } from "@testing-library/react";
import type { Agent, AgentSkillLink } from "@devdigest/shared";
import { makeSkill, renderWithIntl } from "../../../../../../../test/skills-fixtures";

const SKILLS = [
  makeSkill({ id: "a", name: "alpha" }),
  makeSkill({ id: "b", name: "beta", type: "convention" }),
  makeSkill({ id: "c", name: "gamma", enabled: false }),
  makeSkill({ id: "d", name: "delta" }),
];
// Linked: c (order 0, enabled), a (order 1, disabled link). Unlinked: b, d.
const LINKS: AgentSkillLink[] = [
  { agent_id: "ag1", skill_id: "a", order: 1, enabled: false },
  { agent_id: "ag1", skill_id: "c", order: 0, enabled: true },
];
const setMutate = vi.fn();

vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: SKILLS, isLoading: false }),
  useAgentSkills: () => ({ data: LINKS, isLoading: false }),
  useSetAgentSkills: () => ({ mutate: setMutate, isPending: false }),
}));

import { SkillsTab } from "./SkillsTab";

const AGENT = { id: "ag1", name: "Test Quality Reviewer" } as Agent;

beforeEach(() => setMutate.mockReset());
afterEach(cleanup);

const order = () => screen.getAllByTestId(/^skill-row-/).map((el) => el.getAttribute("data-testid")!.replace("skill-row-", ""));
const checkbox = (id: string) => within(screen.getByTestId(`skill-row-${id}`)).getByRole("checkbox");

describe("Agent SkillsTab", () => {
  it("lists linked skills first in link order, then unlinked unchecked", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    expect(order()).toEqual(["c", "a", "b", "d"]);
    expect(checkbox("c")).toHaveAttribute("aria-checked", "true");
    expect(checkbox("a")).toHaveAttribute("aria-checked", "false");
    expect(checkbox("b")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("1 of 4 enabled")).toBeInTheDocument();
  });

  it("greys a globally disabled skill with a hint", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    expect(within(screen.getByTestId("skill-row-c")).getByText("disabled globally")).toBeInTheDocument();
    expect(within(screen.getByTestId("skill-row-a")).queryByText("disabled globally")).not.toBeInTheDocument();
  });

  it("filters rows by name", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    fireEvent.change(screen.getByLabelText("Filter skills…"), { target: { value: "ta" } });
    expect(order()).toEqual(["b", "d"]);
  });

  it("only the grip is draggable, so a click on the row can't start a drag", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    expect(screen.getByTestId("skill-row-a")).not.toHaveAttribute("draggable");
    expect(screen.getByTestId("skill-drag-a")).toHaveAttribute("draggable", "true");
  });

  it("clicking the skill name toggles its checkbox", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    fireEvent.click(within(screen.getByTestId("skill-row-b")).getByText("beta"));
    expect(checkbox("b")).toHaveAttribute("aria-checked", "true");
  });

  it("toggles and reorders, then saves every row in order", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    expect(screen.getByText("Save skills").closest("button")).toBeDisabled();
    fireEvent.click(checkbox("b"));
    expect(screen.getByText("2 of 4 enabled")).toBeInTheDocument();
    // drag d onto c → d becomes first
    fireEvent.dragStart(screen.getByTestId("skill-drag-d"));
    fireEvent.dragOver(screen.getByTestId("skill-row-c"));
    fireEvent.drop(screen.getByTestId("skill-row-c"));
    expect(order()).toEqual(["d", "c", "a", "b"]);
    fireEvent.click(screen.getByText("Save skills"));
    expect(setMutate).toHaveBeenCalledTimes(1);
    expect(setMutate.mock.calls[0]?.[0]).toEqual({
      agentId: "ag1",
      items: [
        { skill_id: "d", enabled: false },
        { skill_id: "c", enabled: true },
        { skill_id: "a", enabled: false },
        { skill_id: "b", enabled: true },
      ],
    });
  });
});
