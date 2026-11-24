# Business logic layers

How to keep components focused on rendering and put rules where they can be tested and reused.

## Contents
1. Layer responsibilities
2. Refactor: rule in JSX → domain function
3. Refactor: orchestration in component → view-model hook
4. Refactor: branching by type → strategy object
5. Gateway: mapping transport data
6. How far to go

## 1. Layer responsibilities

| Layer | Contains | Must not contain | Tested with |
|---|---|---|---|
| View (components) | JSX, event wiring, calling hooks | business rules, fetching, data mapping | component tests |
| View-model (hooks) | UI state, combining queries/mutations, calling domain functions | JSX, transport details | hook tests or via the component |
| Domain (pure functions/modules) | rules, calculations, validation, formatting tied to the domain | React, `fetch`, globals, `Date.now()` without injection | plain unit tests |
| Data / gateway | HTTP client, schemas, DTO → domain mapping, query/mutation definitions | UI decisions (toasts, navigation) | unit tests with mocked transport |

The direction is always downward. A domain function never imports a hook; the API layer never imports a component.

## 2. Refactor: rule in JSX → domain function

Before — the rule is hidden in markup and can't be tested without rendering:
```tsx
export function RunSummary({ run }: { run: Run }) {
  return (
    <div>
      {run.findings.filter(f => !f.dismissed && (f.severity === 'critical' || f.confidence > 0.8)).length > 0 && (
        <Badge tone="danger">Needs attention</Badge>
      )}
    </div>
  );
}
```

After — the rule has a name and a home:
```ts
// lib/findings.ts (or the component folder's helpers.ts if only this component uses it)
export function needsAttention(findings: Finding[]): boolean {
  return findings.some(f => !f.dismissed && (f.severity === 'critical' || f.confidence > 0.8));
}
```
```tsx
export function RunSummary({ run }: { run: Run }) {
  return <div>{needsAttention(run.findings) && <Badge tone="danger">Needs attention</Badge>}</div>;
}
```

Where it lives depends on consumers: one component → its `helpers.ts`; the whole domain → `lib/findings.ts`.

## 3. Refactor: orchestration in component → view-model hook

Before — the component coordinates data, filtering and actions:
```tsx
export function FindingsPanel({ prId }: Props) {
  const { data } = useQuery(reviewQueries.list(prId));
  const [severity, setSeverity] = useState<Severity | null>(null);
  const mutation = useMutation({ mutationFn: api.dismissFinding, onSuccess: () => qc.invalidateQueries(...) });
  const visible = (data ?? []).filter(f => !severity || f.severity === severity);
  const counts = countBySeverity(data ?? []);
  // …80 lines of JSX
}
```

After — the component renders; the hook owns the behaviour:
```ts
// FindingsPanel/useFindingsPanel.ts
export function useFindingsPanel(prId: string) {
  const { data = [] } = useQuery(reviewQueries.list(prId));
  const [severity, setSeverity] = useState<Severity | null>(null);
  const dismiss = useDismissFinding(prId);
  return {
    visible: visibleFindings(data, severity),   // domain helpers
    counts: severityCounts(data),
    severity, setSeverity,
    dismiss: dismiss.mutate,
  };
}
```

Extract a hook when the component body has more orchestration than markup, or when two components need the same behaviour. Don't extract a hook that just wraps one `useState`.

## 4. Refactor: branching by type → strategy object

When the same `if/switch` on a type appears in several places, centralize the variation:
```ts
// lib/severity.ts
export const SEVERITY = {
  critical:   { order: 0, tone: 'danger',  labelKey: 'severity.critical' },
  warning:    { order: 1, tone: 'warning', labelKey: 'severity.warning' },
  suggestion: { order: 2, tone: 'info',    labelKey: 'severity.suggestion' },
} as const satisfies Record<Severity, SeverityMeta>;
```
Adding a severity is now a one-line change, and the type system flags any missing case.

## 5. Gateway: mapping transport data

The data layer is an anti-corruption boundary: it parses what the server sends and returns what the UI needs.
```ts
// features/reviews/api/reviews.ts
const ReviewDto = z.object({ id: z.string(), created_at: z.string(), findings: z.array(FindingDto) });

export async function fetchReviews(prId: string): Promise<Review[]> {
  const json = await apiClient.get(`/pulls/${prId}/reviews`);
  return z.array(ReviewDto).parse(json).map(toReview);   // snake_case → domain shape, string → Date
}
```
If the API changes shape, only this file changes.

## 6. How far to go

- Small app: components + `helpers.ts` + one API module is enough. Don't add layers you can't name a reason for.
- Growing app: add view-model hooks and domain modules per feature as components get crowded.
- Full clean/hexagonal architecture (use-case classes, ports/adapters, DI containers) pays off only when the same domain logic runs against several adapters or must outlive the UI framework. Its authors acknowledge the cost: verbosity, onboarding time, indirection.
- The non-negotiable minimum: rules in pure functions, dependency direction downward.
