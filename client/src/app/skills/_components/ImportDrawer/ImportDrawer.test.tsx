import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { SkillImportPreview } from "@devdigest/shared";
import { renderWithIntl } from "../../../../test/skills-fixtures";

const PREVIEW: SkillImportPreview = {
  name: "flaky-test-patterns",
  description: "Flag sleeps and real time in tests.",
  type: "custom",
  body: "- no sleep()\n- no real network",
  ignored_files: ["scripts/run.sh", "references/notes.md"],
  warnings: ["No type in frontmatter; defaulted to custom."],
};

const parseMutate = vi.fn();
const createMutate = vi.fn();

vi.mock("../../../../lib/hooks/skills", () => ({
  useImportSkillPreview: () => ({
    mutate: parseMutate,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useCreateSkill: () => ({ mutate: createMutate, isPending: false }),
  useSkillTokenCount: () => ({ data: 17 }),
}));

import { ImportDrawer } from "./ImportDrawer";

beforeEach(() => {
  parseMutate.mockReset();
  createMutate.mockReset();
  parseMutate.mockImplementation((_file: File, opts: { onSuccess: (p: SkillImportPreview) => void }) =>
    opts.onSuccess(PREVIEW),
  );
});
afterEach(cleanup);

function pick() {
  const file = new File(["# x"], "skill.zip", { type: "application/zip" });
  fireEvent.change(screen.getByTestId("import-file-input"), { target: { files: [file] } });
  return file;
}

describe("ImportDrawer", () => {
  it("uploads the picked file and shows the preview with ignored files, warnings and trust banner", () => {
    renderWithIntl(<ImportDrawer onClose={() => {}} onImported={() => {}} />);
    const file = pick();
    expect(parseMutate).toHaveBeenCalledWith(file, expect.anything());
    expect(screen.getByText("Not imported, never executed")).toBeInTheDocument();
    expect(screen.getByText("scripts/run.sh")).toBeInTheDocument();
    expect(screen.getByText("references/notes.md")).toBeInTheDocument();
    expect(screen.getByText("No type in frontmatter; defaulted to custom.")).toBeInTheDocument();
    expect(screen.getByText("Imported skill — someone else's instructions")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("flaky-test-patterns");
  });

  it("accepts a dropped file", () => {
    renderWithIntl(<ImportDrawer onClose={() => {}} onImported={() => {}} />);
    const file = new File(["# x"], "SKILL.md");
    fireEvent.drop(screen.getByTestId("import-dropzone"), { dataTransfer: { files: [file] } });
    expect(parseMutate).toHaveBeenCalledWith(file, expect.anything());
  });

  it("saves the edited preview as an imported, disabled skill", () => {
    renderWithIntl(<ImportDrawer onClose={() => {}} onImported={() => {}} />);
    pick();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "flaky-tests" } });
    fireEvent.click(screen.getByText("Save skill (disabled)"));
    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0]?.[0]).toEqual({
      name: "flaky-tests",
      description: PREVIEW.description,
      type: "custom",
      body: PREVIEW.body,
      source: "imported",
      enabled: false,
    });
  });

  it("cancel closes without persisting anything", () => {
    const onClose = vi.fn();
    renderWithIntl(<ImportDrawer onClose={onClose} onImported={() => {}} />);
    pick();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
    expect(createMutate).not.toHaveBeenCalled();
  });
});
