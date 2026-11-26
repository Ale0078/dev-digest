import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunTrace } from "@devdigest/shared";
import messages from "../../../../../../../../../../messages/en/runs.json";
import { TraceBody } from "./TraceBody";

afterEach(cleanup);

const BASE: RunTrace = {
  config: { agent: "TQR", version: "1", provider: "openai", model: "gpt-4.1", pr: 7, source: "local" },
  stats: { duration_ms: 1000, tokens_in: 1000, tokens_out: 100, cost_usd: null, findings: 0, grounding: "0/0 passed" },
  prompt_assembly: { system: "sys", skills: "## Skills\n### a\nd\n\nb", user: "diff" },
  tool_calls: [{ tool: "review", args: "all", ms: 10 }],
  raw_output: "{}",
  memory_pulled: [],
  specs_read: [],
  log: [],
};

function renderTrace(trace: RunTrace) {
  render(
    <NextIntlClientProvider locale="en" messages={{ runs: messages }}>
      <TraceBody trace={trace} findings={[]} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByText("Prompt assembly"));
}

describe("TraceBody · Skills block meta", () => {
  it("shows +K tok and the injected skills with versions", () => {
    renderTrace({
      ...BASE,
      config: { ...BASE.config, skills: [{ id: "s1", name: "branch-coverage-gate", version: 2 }, { id: "s2", name: "mocking-smells", version: 1 }] },
      prompt_assembly: { ...BASE.prompt_assembly, skills_tokens: 1234 },
    });
    const meta = screen.getByTestId("skills-meta");
    expect(within(meta).getByText("+1,234 tok")).toBeInTheDocument();
    expect(within(meta).getByText("branch-coverage-gate v2")).toBeInTheDocument();
    expect(within(meta).getByText("mocking-smells v1")).toBeInTheDocument();
    expect(within(meta).queryByText(/chunks/)).not.toBeInTheDocument();
  });

  it("shows × N chunks in map-reduce (more than one tool call)", () => {
    renderTrace({
      ...BASE,
      prompt_assembly: { ...BASE.prompt_assembly, skills_tokens: 300 },
      tool_calls: [
        { tool: "review_file", args: "a.ts", ms: 1 },
        { tool: "review_file", args: "b.ts", ms: 1 },
        { tool: "review_file", args: "c.ts", ms: 1 },
      ],
    });
    expect(screen.getByText("× 3 chunks")).toBeInTheDocument();
  });

  it("renders a pre-M2 trace without the new fields", () => {
    renderTrace(BASE);
    expect(screen.getByText("Skills (dynamic)")).toBeInTheDocument();
    expect(screen.queryByTestId("skills-meta")).not.toBeInTheDocument();
  });
});
