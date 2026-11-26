import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { makeSkill, renderWithIntl } from "../../../../test/skills-fixtures";
import { SkillCard } from "./SkillCard";

afterEach(cleanup);

describe("SkillCard", () => {
  it("renders name, badges and the stats footer", () => {
    renderWithIntl(<SkillCard skill={makeSkill()} />);
    expect(screen.getByText("branch-coverage-gate")).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("2 agents · 50% pull · 75% accept")).toBeInTheDocument();
  });

  it("shows — for missing rates and the Imported badge for legacy imported_url", () => {
    renderWithIntl(
      <SkillCard
        skill={makeSkill({ agent_count: 1, source: "imported_url", stats: { pull_rate: null, accept_rate: null } })}
      />,
    );
    expect(screen.getByText("1 agent · — pull · — accept")).toBeInTheDocument();
    expect(screen.getByText("Imported")).toBeInTheDocument();
  });

  it("toggles without selecting the card", () => {
    const onToggle = vi.fn();
    const onClick = vi.fn();
    renderWithIntl(<SkillCard skill={makeSkill()} onToggle={onToggle} onClick={onClick} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onClick).not.toHaveBeenCalled();
  });
});
