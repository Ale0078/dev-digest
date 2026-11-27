import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { makeConvention, renderWithIntl } from "../../../../../../test/conventions-fixtures";

const createMutate = vi.fn();

vi.mock("@/lib/hooks/conventions", () => ({
  useCreateConventionSkill: () => ({ mutate: createMutate, isPending: false, isError: false, error: null }),
}));
vi.mock("@/lib/hooks/skills", () => ({
  useSkillTokenCount: () => ({ data: 42 }),
}));

import { CreateSkillModal } from "./CreateSkillModal";

const A = makeConvention({ id: "a", rule: "Rule Alpha", evidence_snippet: "alpha()" });
const B = makeConvention({ id: "b", rule: "Rule Beta", evidence_path: "src/b.ts", evidence_snippet: "beta()" });

beforeEach(() => createMutate.mockReset());
afterEach(cleanup);

function open() {
  const onCreated = vi.fn();
  renderWithIntl(
    <CreateSkillModal repoId="r1" repoName="acme/app" accepted={[A, B]} onClose={vi.fn()} onCreated={onCreated} />,
  );
  return { onCreated };
}

const body = () => screen.getByLabelText("Skill body (Markdown)") as HTMLTextAreaElement;
const createBtn = () => screen.getByRole("button", { name: "Create skill" }) as HTMLButtonElement;

describe("CreateSkillModal", () => {
  it("prefills name, description and a body merged from the accepted conventions", () => {
    open();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("repo-conventions");
    expect((screen.getByLabelText("Description") as HTMLInputElement).value).toBe(
      "2 house conventions extracted from acme/app",
    );
    expect((screen.getByLabelText("Type") as HTMLInputElement).value).toBe("convention");
    expect(body().value).toContain("## 1. Rule Alpha");
    expect(body().value).toContain("## 2. Rule Beta");
    expect(body().value).toContain("Detected in `src/b.ts:3-4`");
  });

  it("drops an unchecked convention from the body and the payload", () => {
    open();
    fireEvent.click(screen.getByText("Rule Alpha"));
    expect(body().value).not.toContain("Rule Alpha");
    fireEvent.click(createBtn());
    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0]![0]).toMatchObject({
      name: "repo-conventions",
      description: "1 house convention extracted from acme/app",
      enabled: false,
      convention_ids: ["b"],
    });
  });

  it("keeps user edits of name, description and body", () => {
    open();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "api-layer" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Flag raw axios calls" } });
    fireEvent.change(body(), { target: { value: "# api-layer\n\ncustom body" } });
    fireEvent.click(createBtn());
    expect(createMutate.mock.calls[0]![0]).toMatchObject({
      name: "api-layer",
      description: "Flag raw axios calls",
      body: "# api-layer\n\ncustom body",
      convention_ids: ["a", "b"],
    });
  });

  it("blocks saving with an invalid slug or nothing selected", () => {
    open();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Repo Rules" } });
    expect(screen.getByText("Use lowercase letters, digits and dashes only.")).toBeTruthy();
    expect(createBtn().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "repo-rules" } });
    expect(createBtn().disabled).toBe(false);
    fireEvent.click(screen.getByText("Rule Alpha"));
    fireEvent.click(screen.getByText("Rule Beta"));
    expect(screen.getByText("Select at least one accepted convention.")).toBeTruthy();
    expect(createBtn().disabled).toBe(true);
  });
});
