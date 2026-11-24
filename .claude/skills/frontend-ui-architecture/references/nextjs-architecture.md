# Next.js App Router architecture

Structural decisions specific to the App Router. For file conventions (`layout`, `loading`, `error`, …), directive mechanics and optimization, see `next-best-practices`.

## Contents
1. `app/` is the routing layer
2. Colocation and promotion
3. Server/client split as architecture
4. Choosing one data-access approach
5. Server Actions placement
6. Where TanStack Query fits

## 1. `app/` is the routing layer

- `page.tsx` / `layout.tsx` stay thin: read `params`/`searchParams`, check access, compose feature components. Business logic and markup-heavy UI live in components and domain modules.
- Folder names like `components`, `lib`, `utils`, `hooks` have no meaning to Next.js; their structure is your convention, so write it down.
- Use route groups `(name)` to give sections their own layout or to organize routes by team/area without affecting URLs.

## 2. Colocation and promotion

- Route-only code goes next to the route in private folders: `_components/`, `_lib/`, `_hooks/`. The underscore marks "not a route" and avoids clashes with future conventions.
- Promotion path: `route/_components` → common ancestor `_components` → `components/` (generic) or `features/<f>/` (domain) outside `app/`.
- Feature-Sliced Design proposes keeping `app/` as pure re-exports and moving pages into `src/_pages`. That conflicts with Next.js's own colocation model; prefer Next's model unless the team has adopted FSD fully.

## 3. Server/client split as architecture

- Server Components by default: data fetching, access checks and heavy rendering stay on the server and out of the bundle.
- `'use client'` on interactive **leaves** (a button, a filter bar), not on whole pages. The directive marks a boundary: everything imported below it becomes client code.
- Pass Server Components into Client Components through `children`/slots instead of importing them, so interactivity doesn't drag the subtree to the client.
- Props crossing the boundary must be serializable — another reason to shape data into small DTOs before it reaches a Client Component.
- Mark modules that must never reach the client with `import 'server-only'` (DB access, secrets); mark browser-only modules with `client-only`.
- Providers (theme, query client) are Client Components; render them as deep as possible, wrapping `children`.
- If an app fetches only on the client from a separate backend, most components will be Client Components — that's fine; the rest of this skill (layers, colocation) still applies.

## 4. Choosing one data-access approach

Next.js recommends picking one and not mixing them, because mixing hides where authorization happens:

| Approach | When | Shape |
|---|---|---|
| External HTTP API | existing backend, larger orgs | Next acts as a client; auth enforced by the API |
| Data Access Layer (DAL) | new full-stack Next apps | `server-only` modules (`lib/dal/…`) that check auth, query data, return minimal DTOs; only the DAL reads env/secrets |
| Component-level data access | prototypes only | queries in Server Components directly |

A DAL returns DTOs shaped for the UI, never raw DB records, so private fields can't leak into Client Component props.

## 5. Server Actions placement

- Treat every Server Action as a public POST endpoint.
- Keep them in a dedicated module per domain (`features/<f>/actions.ts` or `app/<route>/_actions.ts`) with `'use server'` at the top, rather than inline in components — one place to audit.
- Inside each action: validate input with a schema, re-check authentication and ownership, call the domain/DAL, return a minimal result.
- Send IDs, not whole objects, and re-read the record server-side.
- Actions are for mutations; don't use them to fetch data or call them from a `queryFn`.

## 6. Where TanStack Query fits

- In server-first apps you may not need it; Server Components + Server Actions cover simple fetch/mutate flows.
- It earns its place for client-heavy interaction: polling, infinite lists, optimistic updates, offline, or a separate API backend.
- When combined with RSC: create a new `QueryClient` per request on the server and a singleton in the browser, prefetch in a Server Component and pass state through `HydrationBoundary`, and treat Server Components as a place to prefetch — not to own the data afterwards.
