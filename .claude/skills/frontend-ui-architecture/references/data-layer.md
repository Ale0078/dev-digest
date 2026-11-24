# Data layer

Organization of client-side data access: one transport module, parsing at the boundary, query definitions per domain. Examples use TanStack Query v5 and Zod; the structure applies to other libraries too.

## Contents
1. Layout
2. API client
3. Parse at the boundary
4. `queryOptions` factories
5. Custom hooks (optional layer)
6. Mutations and invalidation
7. Error placement
8. Server state vs other state

## 1. Layout

```
lib/
├── api-client.ts            # transport only: base URL, headers, auth, error normalization
└── query-client.ts          # QueryClient defaults, global cache handlers
features/reviews/api/        # or lib/reviews/ in apps without feature folders
├── schemas.ts               # response/request schemas (or import from a shared contracts package)
├── reviews.ts               # fetchers: call client, parse, map
├── queries.ts               # queryOptions factories + key structure
└── mutations.ts             # mutation hooks / options
```

The transport is shared; endpoints, keys and mapping belong to the domain that owns them.

## 2. API client

- One module, one place for base URL, credentials, headers, timeouts and turning non-2xx responses into a typed error.
- Exposes small primitives (`get`, `post`, …) returning `unknown` — typing happens in the domain fetchers after parsing.
- No UI concerns: no toasts, no redirects. Those are decided by callers or the global query cache handler.

## 3. Parse at the boundary

```ts
export async function fetchReview(id: string) {
  const json = await apiClient.get(`/reviews/${id}`);
  return ReviewSchema.parse(json);       // throws → becomes a normal query error
}
```
- Parsing turns "I hope it's this shape" (`as Review`) into a checked fact. Downstream code trusts the type and doesn't re-validate.
- Make schemas tolerant where the server is loose (optional vs nullable), or a harmless change breaks the UI.
- If contracts are shared with a backend, import the schemas from that contracts module instead of redefining them.

## 4. `queryOptions` factories

Keep the key and the fetcher together, per domain:
```ts
// features/reviews/api/queries.ts
export const reviewQueries = {
  all: () => ['reviews'] as const,
  lists: () => [...reviewQueries.all(), 'list'] as const,
  list: (prId: string) =>
    queryOptions({ queryKey: [...reviewQueries.lists(), prId], queryFn: () => fetchReviews(prId) }),
  detail: (id: string) =>
    queryOptions({ queryKey: [...reviewQueries.all(), 'detail', id], queryFn: () => fetchReview(id) }),
};
```
- Usable everywhere: `useQuery`, `useSuspenseQuery`, `useQueries`, `queryClient.prefetchQuery`, `setQueryData` — including outside components (loaders, event handlers, server prefetch).
- Keys go generic → specific, so `invalidateQueries({ queryKey: reviewQueries.all() })` hits the whole domain.
- Put only shared, fixed options in the factory; per-call options (`select`, `enabled`, `throwOnError`) are spread at the call site.
- No global `queryKeys.ts` for the whole app: keys are part of their domain.

## 5. Custom hooks (optional layer)

A hook that only does `useQuery(reviewQueries.list(id))` adds an indirection and locks callers to one variant. Add a hook when it adds something: combining queries, a stable `select`, domain defaults, or when the project convention is "components consume hooks" — in that case build every hook on the factories:
```ts
export const usePrReviews = (prId: string) => useQuery(reviewQueries.list(prId));
```

## 6. Mutations and invalidation

```ts
export function useDismissFinding(prId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: dismissFinding,
    onSuccess: () => qc.invalidateQueries({ queryKey: reviewQueries.list(prId).queryKey }), // always runs
  });
}

// call site — UI reactions only
dismiss.mutate(id, { onSuccess: () => toast.success(t('dismissed')) });
```
- Logic that must always follow a mutation (invalidation, cache updates) lives in the mutation definition.
- UI reactions (toast, navigation, closing a dialog) live at the call site, because they depend on where the user is.
- Return the `invalidateQueries` promise from `onSuccess` if the mutation should stay pending until fresh data arrives.
- For apps with many mutations, a global `MutationCache.onSuccess` that invalidates by `meta` tags centralizes the rule.

## 7. Error placement

| Error kind | Where handled |
|---|---|
| Expected, blocks this view (404, empty) | in the component rendering the query, via `error`/status |
| Background refetch failure | global `QueryCache.onError` → one toast (only when cached data is shown) |
| Unexpected / 5xx | error boundary (`throwOnError` for those cases) |
| Mutation failure | call site (inline message) or global mutation handler |
| Transport normalization | the API client |

## 8. Server state vs other state

Fetched data lives in the query cache, not in `useState` or a global store; once server state moves there, global client state is usually tiny. Forms are the deliberate exception: initialise the form from server data (render the form only when data is present) and keep only the user's edits in form state.
