import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { SkillStats } from "@devdigest/shared";
import { renderWithIntl } from "../../../../../../../test/skills-fixtures";

const push = vi.fn();
let STATS: SkillStats;

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkillStats: () => ({ data: STATS, isLoading: false, isError: false }),
}));

import { StatsTab } from "./StatsTab";

afterEach(cleanup);

describe("StatsTab", () => {
  it("renders tiles, agents with Open, and a COUNT legend (no $)", () => {
    STATS = {
      used_by: 2,
      pull_rate: 0.8,
      accept_rate: 0.6,
      findings_30d: 7,
      agents: [{ id: "ag1", name: "Test Quality Reviewer" }],
      by_category: [
        { category: "test", count: 5 },
        { category: "bug", count: 2 },
      ],
    };
    renderWithIntl(<StatsTab skillId="sk1" />);
    expect(screen.getByText("2 agents")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByTestId("accept-ring")).toHaveTextContent("60");
    expect(screen.getByText("7")).toBeInTheDocument();
    const legend = screen.getByRole("list");
    expect(legend).toHaveTextContent("test5");
    expect(legend).toHaveTextContent("bug2");
    expect(legend).not.toHaveTextContent("$");
    fireEvent.click(screen.getByText("Open"));
    expect(push).toHaveBeenCalledWith("/agents/ag1?tab=skills");
  });

  it("shows — when there is no data", () => {
    STATS = { used_by: 0, pull_rate: null, accept_rate: null, findings_30d: 0, agents: [], by_category: [] };
    renderWithIntl(<StatsTab skillId="sk1" />);
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByTestId("accept-ring")).not.toBeInTheDocument();
    expect(screen.getByText("No agent has this skill enabled.")).toBeInTheDocument();
  });
});
