/* Test-only fixtures + an intl render helper for the Conventions screen. */
import React from "react";
import { render, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import conventions from "../../messages/en/conventions.json";
import skills from "../../messages/en/skills.json";
import { ToastProvider } from "../lib/toast";

export function makeConvention(over: Partial<ConventionCandidate> = {}): ConventionCandidate {
  return {
    id: "c1",
    rule: "HTTP calls go through the shared axios instance",
    evidence_path: "client/src/api/index.js",
    evidence_snippet: "export { default as axios } from './axiosConfig'",
    confidence: 0.5,
    accepted: false,
    evidence_line_start: 3,
    evidence_line_end: 4,
    ...over,
  };
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ conventions, skills }}>
      <ToastProvider>{children}</ToastProvider>
    </NextIntlClientProvider>
  );
}

/** `wrapper` (not inline JSX) so `rerender` keeps the providers. */
export function renderWithIntl(ui: React.ReactElement): RenderResult {
  return render(ui, { wrapper: Providers });
}
