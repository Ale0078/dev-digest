import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent, within } from "@testing-library/react";
import { makeConvention, renderWithIntl } from "../../../../../../test/conventions-fixtures";
import { ConventionCard, evidenceLocation, type ConventionCardProps } from "./ConventionCard";

afterEach(cleanup);

function setup(over: Partial<ConventionCardProps> = {}) {
  const props: ConventionCardProps = {
    convention: makeConvention(),
    status: "pending",
    evidenceHref: "https://github.com/acme/app/blob/main/client/src/api/index.js#L3-L4",
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onSaveRule: vi.fn(),
    ...over,
  };
  renderWithIntl(<ConventionCard {...props} />);
  return props;
}

describe("ConventionCard", () => {
  it("shows rule, evidence link to GitHub, snippet and confidence", () => {
    setup();
    expect(screen.getByText("HTTP calls go through the shared axios instance")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Open client/src/api/index.js:3-4 on GitHub" });
    expect(link.getAttribute("href")).toBe(
      "https://github.com/acme/app/blob/main/client/src/api/index.js#L3-L4",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.getByText("export { default as axios } from './axiosConfig'")).toBeTruthy();
    expect(screen.getByText("50% confidence")).toBeTruthy();
  });

  it("accepts, un-accepts and rejects", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(p.onAccept).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(p.onReject).toHaveBeenCalled();
    cleanup();

    const q = setup({ convention: makeConvention({ accepted: true }), status: "accepted" });
    const card = screen.getByTestId("convention-card");
    expect(within(card).getAllByText("Accepted").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Accepted" }));
    expect(q.onAccept).toHaveBeenCalledWith(false);
  });

  it("renders a rejected card dimmed with actions disabled", () => {
    setup({ status: "rejected" });
    expect(screen.getByTestId("convention-card").getAttribute("data-status")).toBe("rejected");
    expect((screen.getByRole("button", { name: "Accept" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("edits the rule text and saves the trimmed value", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const box = within(screen.getByRole("group", { name: "Convention rule" })).getByRole("textbox");
    fireEvent.change(box, { target: { value: "  Use the shared http client  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(p.onSaveRule).toHaveBeenCalledWith("Use the shared http client");
  });

  it("formats the evidence location", () => {
    expect(evidenceLocation(makeConvention({ evidence_line_start: 7, evidence_line_end: 7 }))).toBe(
      "client/src/api/index.js:7",
    );
    expect(evidenceLocation(makeConvention({ evidence_line_start: null, evidence_line_end: null }))).toBe(
      "client/src/api/index.js",
    );
  });
});
