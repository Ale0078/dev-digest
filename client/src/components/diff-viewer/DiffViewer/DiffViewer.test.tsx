import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, PrFile } from "@devdigest/shared";
import prReview from "../../../../messages/en/prReview.json";
import shell from "../../../../messages/en/shell.json";
import { DiffViewer } from "./DiffViewer";
import type { DiffFindingApi, DiffGroup } from "../findings";

afterEach(cleanup);

const PATCH = "@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: 1,\n   redisUrl: x,";
const file = (path: string, patch: string | null = PATCH): PrFile =>
  ({ path, additions: 1, deletions: 0, patch }) as PrFile;

function finding(over: Partial<FindingRecord>): FindingRecord {
  return {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded key",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "r",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...over,
  } as FindingRecord;
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ prReview, shell }}>
      {children}
    </NextIntlClientProvider>
  );
}
const view = (ui: React.ReactElement) => render(ui, { wrapper: Providers });

const api = (findings: FindingRecord[], show = true): DiffFindingApi => ({
  findings,
  show,
  renderFinding: (f) => <div data-testid={`card-${f.id}`}>{f.title}</div>,
});

const CONFIG = file("src/config.ts");
const OTHER = file("src/other.ts");
const LOCK = file("pnpm-lock.yaml");

const group = (over: Partial<DiffGroup> & Pick<DiffGroup, "key" | "files">): DiffGroup => ({
  label: over.key,
  subtitle: `${over.key}-sub`,
  color: "red",
  findingFileCount: 0,
  defaultOpen: true,
  ...over,
});

describe("DiffViewer groups", () => {
  it("renders headers in order with file counts", () => {
    const groups = [group({ key: "Core", files: [CONFIG, OTHER] }), group({ key: "Boiler", files: [LOCK] })];
    view(<DiffViewer files={[CONFIG, OTHER, LOCK]} groups={groups} findingApi={api([])} />);
    const heads = screen.getAllByRole("button", { expanded: true });
    expect(heads[0]).toHaveTextContent("Core");
    expect(heads[0]).toHaveTextContent("2 files");
    expect(heads[1]).toHaveTextContent("Boiler");
    expect(heads[1]).toHaveTextContent("1 files");
  });

  it("hides files in a collapsed group and opens on header click", () => {
    const groups = [group({ key: "Docs", files: [LOCK], defaultOpen: false })];
    view(<DiffViewer files={[LOCK]} groups={groups} />);
    expect(screen.queryByText("pnpm-lock.yaml")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Docs/ }));
    expect(screen.getByText("pnpm-lock.yaml")).toBeInTheDocument();
  });

  it("shows '● N' when N > 0 and the no-review hint when null", () => {
    const groups = [
      group({ key: "A", files: [CONFIG], findingFileCount: 2 }),
      group({ key: "B", files: [OTHER], findingFileCount: null }),
      group({ key: "C", files: [LOCK], findingFileCount: 0 }),
    ];
    view(<DiffViewer files={[CONFIG, OTHER, LOCK]} groups={groups} />);
    expect(screen.getByText("● 2")).toBeInTheDocument();
    expect(screen.getAllByText("Review not run yet")).toHaveLength(1);
    expect(screen.queryByText("● 0")).toBeNull();
  });
});

describe("DiffViewer findings", () => {
  it("marks only files with findings with the dot", () => {
    view(<DiffViewer files={[CONFIG, OTHER]} findingApi={api([finding({})])} />);
    expect(screen.getAllByRole("img", { name: "Has findings" })).toHaveLength(1);
  });

  it("renders the card under its line and an unplaced one in the end block", () => {
    view(
      <DiffViewer
        files={[CONFIG]}
        findingApi={api([finding({ id: "p" , title: "Placed"}), finding({ id: "u", title: "Far away", start_line: 999 })])}
      />,
    );
    expect(screen.getByTestId("card-p")).toBeInTheDocument();
    const block = screen.getByText(/Findings not on a diff line/).parentElement!;
    expect(within(block).getByTestId("card-u")).toBeInTheDocument();
    expect(within(block).queryByTestId("card-p")).toBeNull();
  });

  it("labels a CRITICAL line 'blocker'", () => {
    view(<DiffViewer files={[CONFIG]} findingApi={api([finding({})])} />);
    expect(screen.getByText("blocker")).toBeInTheDocument();
  });

  it("with show:false renders no cards but keeps the dot and the label", () => {
    view(
      <DiffViewer
        files={[CONFIG]}
        findingApi={api([finding({}), finding({ id: "u", start_line: 999 })], false)}
      />,
    );
    expect(screen.queryByTestId("card-f1")).toBeNull();
    expect(screen.queryByTestId("card-u")).toBeNull();
    expect(screen.getByRole("img", { name: "Has findings" })).toBeInTheDocument();
    expect(screen.getByText("blocker")).toBeInTheDocument();
  });
});
