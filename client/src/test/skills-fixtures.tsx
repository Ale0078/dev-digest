/* Test-only fixtures + an intl render helper for the Skills screens. */
import React from "react";
import { render, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import skills from "../../messages/en/skills.json";
import agents from "../../messages/en/agents.json";
import runs from "../../messages/en/runs.json";
import { ToastProvider } from "../lib/toast";

export function makeSkill(over: Partial<Skill> = {}): Skill {
  return {
    id: "sk1",
    name: "branch-coverage-gate",
    description: "Every new branch needs an asserting test.",
    type: "rubric",
    source: "manual",
    body: "- rule one\n- rule two",
    enabled: true,
    version: 3,
    evidence_files: null,
    agent_count: 2,
    body_tokens: 42,
    updated_at: "2026-11-20T10:00:00.000Z",
    stats: { pull_rate: 0.5, accept_rate: 0.75 },
    ...over,
  };
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ skills, agents, runs }}>
      <ToastProvider>{children}</ToastProvider>
    </NextIntlClientProvider>
  );
}

/** `wrapper` (not inline JSX) so `rerender` keeps the providers. */
export function renderWithIntl(ui: React.ReactElement): RenderResult {
  return render(ui, { wrapper: Providers });
}
