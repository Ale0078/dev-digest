---
name: frontend-ui-architecture
description: "Frontend UI architecture and code organization for React and Next.js (App Router) apps: where components, hooks, constants, types, helpers, API calls and business logic live; how to split components; folder structure (route-colocated vs feature vs shared); dependency direction and import boundaries; the server/client split as an architectural decision. Use this skill whenever the user asks where to put a file or piece of code, how to structure or restructure folders, whether to extract something into helpers/lib/utils, where business logic or state should live, how to organize the data layer, or asks for an architecture review of a frontend, even if they don't say 'architecture'. Not about rendering performance or React API rules (see react-best-practices / next-best-practices)."
metadata:
  version: "1.0.0"
---

# Frontend UI Architecture

How to organize code in a React / Next.js App Router frontend so that a reader can predict where something lives and a change touches as few places as possible.

This skill is about **placement and boundaries**. For hook rules, effects, memoization, keys and similar API correctness, use `react-best-practices`. For Next.js special files, RSC directive rules, metadata, images and fonts, use `next-best-practices`. Rendering performance is out of scope.

## Core principles

These six ideas resolve most "where does this go?" questions. Each has a reason; when a rule below seems to conflict with a project's existing convention, the reasons are what to weigh.

1. **Colocate by default.** Put code as close as possible to where it is used: component, its test, styles, helpers, constants and types in one folder. Things that change together should live together, and deleting a feature should mean deleting a folder, not hunting through `utils/`, `types/` and `constants/`.
2. **Promote on the second consumer, not before.** Code moves up (route → feature → shared) only when a second, real consumer appears. Guessing at reuse produces abstractions shaped around one caller that the next caller has to fight. Some duplication is cheaper than the wrong abstraction (AHA / WET).
3. **Dependencies flow one way: `shared → features → app/routes`.** Shared code knows nothing about features; features know nothing about routes. This makes shared code safe to change and features safe to delete.
4. **Features don't import each other.** If two features need the same thing, either it belongs in shared, or a route/page composes both. Cross-feature imports turn the module graph into a web where nothing can be moved.
5. **Components render; logic lives in plain functions and hooks.** The React view is only one consumer of domain logic. Logic in pure functions is testable without rendering and reusable from server code, loaders and event handlers.
6. **Consistency beats the "best" scheme.** Every source agrees that a consistently applied structure is better than a mix of good ones. Follow the project's existing convention unless it violates the principles above; then propose the change explicitly instead of silently starting a second convention.

## Where does this go? (decision guide)

Start at the narrowest scope and go up only when the item has consumers in more than one place at that scope.

| Item | Used in one component | Used across one feature/route | Used across features |
|---|---|---|---|
| Component | inside the parent's folder (or same file if tiny and private) | `<route>/_components/<Name>/` or `features/<f>/components/<Name>/` | `components/` (shared UI, no domain knowledge) |
| Hook | same file / component folder | `features/<f>/hooks/` or route `_hooks/` | `hooks/` (generic) or `lib/<domain>/` (domain) |
| Pure function | top of the file, outside the component | `helpers.ts` in that folder | `lib/<domain>.ts` |
| Constant | top of the module | `constants.ts` in that folder | `lib/<domain>/constants.ts`; app-wide settings → `config/` |
| Type | inline / same file | `types.ts` in that folder | `lib/<domain>/types.ts`; API contracts → the contracts/schema module |
| API call | never in a component | `features/<f>/api/` or the domain's query module | the single API client in `lib/api` |
| UI string | i18n message file, namespaced by component/feature | same | same |
| Env / config | read once in `config/` (validated), never `process.env` scattered | — | — |

Two checks before creating a new file or folder:
- **Does a home already exist?** Search for an existing module of that domain before creating a parallel one.
- **Is the name a domain or a job?** `lib/review-status.ts` is a good name; `utils/misc.ts`, `helpers/index.ts`, `common.ts` are not — they are places to avoid deciding.

## Components

**Three tiers.** Route-local (used by one route) → feature (used by several routes of one domain) → shared UI (generic, no domain knowledge, takes data through props). A shared UI component must not import from features or call domain hooks; if it needs to, it is a feature component.

**Folder shape** for a non-trivial component — only the files it needs:
```
FindingCard/
├── FindingCard.tsx        # the component (named export)
├── FindingCard.test.tsx
├── styles.ts | FindingCard.module.css
├── helpers.ts             # pure functions only this component uses
├── constants.ts
└── types.ts
```
Small private sub-components can live in the same file or as sibling files in the folder. Keep nesting to 3–4 levels at most; deeper trees mean the component is really a feature.

**When to split a component:**
- It has more than one reason to change (layout vs. a data rule vs. an interaction).
- A part has its own state or behaviour that the rest does not need (push state down).
- A part is needed elsewhere (second consumer).
- The JSX mixes several distinct UI states (loading / empty / list / detail) that read better as named components.

**When not to split:** to hit a line count, to create a "reusable" component with one caller, or into wrappers that only pass props through.

**Structural patterns** (choose by the problem, not by habit):
- *Composition / `children` / slots* — when a wrapper doesn't need to know its content. First choice before context or props-drilling.
- *Compound components* (`<Tabs><Tabs.List/>…`) — a family of parts sharing implicit state; share via context guarded by a hook.
- *Headless hook + view* (`useCombobox` + markup) — when the behaviour (state, keyboard, ARIA) is reusable but looks vary.
- *Inversion of control* — let callers pass behaviour (render prop, callback, item renderer) instead of adding the tenth boolean prop. Don't invert for a single use case.

## Constants and configuration

- Module-local constants sit at the top of the module that uses them. Don't create a `constants.ts` for one value.
- Folder-level `constants.ts` when several files in that folder share them.
- Domain constants (statuses, severity order, limits) live with their domain in `lib/<domain>/`, next to the types they describe. Prefer a `const` object + derived union type over loose strings, so the set of values is defined once.
- App-wide settings and environment values go in `config/`, parsed and validated once at startup, then imported. Scattered `process.env.X` reads make configuration undiscoverable and unvalidated.
- UI text is not a constant: it belongs in i18n messages.

## helpers and lib (no junk-drawer utils)

- A pure function used by one component stays in that file, **outside** the component body.
- When several files in one folder use it → `helpers.ts` in that folder.
- When several features use it → a named domain module in `lib/` (`lib/format.ts`, `lib/github-urls.ts`, `lib/review-status.ts`). `lib/` also holds preconfigured wrappers of third-party libraries (API client, query client, i18n setup).
- A generic `utils/` folder only for truly project-agnostic functions, and only once there are several. Never `utils/misc.ts` or `helpers/index.ts`.
- Name by purpose. The `use` prefix is reserved for functions that call hooks; a pure function must not have it.
- Helpers are pure: no React, no fetching, no reading globals. That is what makes them cheap to test and move.

## Business logic

Think in four layers; small apps can collapse them, but the direction stays the same.

```
view (components)        renders, wires events, no rules
   ↓ calls
view-model (hooks)       UI state + orchestration; calls domain + data
   ↓ calls
domain (pure functions)  rules, calculations, mapping; no React, no IO
   ↓ uses
data / gateway (api)     HTTP client, parsing, DTO → domain mapping
```

- Components should read like a description of the UI. If a component contains a business rule (`if (finding.severity === 'critical' && !run.dismissed) …`), extract it to a named domain function.
- Pages/route files stay thin: read params, compose feature components, nothing else.
- Container/presentational as a *file split* is no longer recommended; the same separation is achieved by a hook holding the logic and a component rendering. Use the split only where a project already does it consistently.
- Clean/hexagonal architecture in full (use-case classes, ports, DI) is usually over-engineering for a UI. The minimum worth keeping: a pure domain layer and the one-way dependency direction.
- Domain functions are reusable from the server (RSC, route handlers, server actions) because they don't import React.

Details, examples and refactoring recipes: [references/business-logic-layers.md](references/business-logic-layers.md).

## Where state lives

| Kind of state | Home |
|---|---|
| Server data (fetched) | the data layer's cache (e.g. TanStack Query) or Server Components — never copied into `useState` |
| Shareable view state (filters, tab, page, search) | the URL search params |
| Form drafts | the form (form library or local state), initialised from server data |
| Local UI state (open, hover, selection) | the lowest component that needs it |
| Cross-cutting app state (theme, session, toasts) | a small, single-concern context/provider near the root |

Lift state only as far as the closest common owner. For the mechanics (derive vs. store, effects, reducers) see `react-best-practices`.

## Data layer

- One API client module wraps transport (base URL, auth, errors). Components never call `fetch` directly.
- **Parse at the boundary.** Validate responses with a schema (e.g. Zod) in the data layer and pass typed data inward, so nothing downstream re-checks shapes. Map transport DTOs to what the UI needs there too.
- With TanStack Query, the base abstraction is a **`queryOptions` factory per domain** (key + fetcher together), colocated with the domain. Custom `useXxx` hooks are optional and should be built on top of those factories, adding real logic rather than only forwarding.
- Query keys go from generic to specific (`['reviews', 'list', filters]`, `['reviews', 'detail', id]`) so invalidation can target a whole domain.
- Mutations: invalidation (logic that must always run) in the mutation definition; UI reactions (toast, redirect, close dialog) at the call site.
- Errors: blocking errors handled where the data is rendered; global notifications in one place (query cache handler); unexpected errors go to error boundaries.

Details and code: [references/data-layer.md](references/data-layer.md).

## Next.js App Router

- `app/` is for routing. Colocate route-only code in private folders (`_components/`, `_lib/`) next to the route; put code shared across routes outside `app/` (`components/`, `features/`, `lib/`).
- Use `(groups)` to organize routes and share layouts without changing URLs.
- Decide the server/client split per component as an architectural choice: Server Components by default, `'use client'` on interactive leaves, Server Components passed through `children` into Client Components.
- Pick **one** data-access approach per app: an external HTTP API, a server-side Data Access Layer (`server-only`, returns DTOs, does auth), or (prototypes only) data access in components. Mixing them hides where authorization happens.
- Server Actions are public endpoints: keep them in a dedicated module per domain (`features/<f>/actions.ts`), validate input and re-check auth inside each.

Details: [references/nextjs-architecture.md](references/nextjs-architecture.md). File conventions and directive rules: `next-best-practices`.

## Imports and boundaries

- Import files directly. **No barrel files (`index.ts` re-exports) inside app code**: they create cycles, blur ownership and make every import load the whole folder. An `index.ts` is fine as the public entry of a real package.
- One path alias (`@/…`) for cross-folder imports; relative imports within a folder.
- Enforce the dependency direction with lint (`import/no-restricted-paths` zones or `eslint-plugin-boundaries`) once the codebase has more than a few features — conventions that aren't enforced erode.

Configs: [references/import-boundaries.md](references/import-boundaries.md).

## Organization anti-patterns

| Smell | Why it hurts | Instead |
|---|---|---|
| `utils/` / `helpers/` junk drawer | no owner, grows into hidden core logic | domain-named module where it's used |
| Global `types.ts` / `constants.ts` for everything | every change touches one file; couples unrelated code | colocate; promote per domain |
| Barrel `index.ts` in every folder | cycles, unclear public surface | direct imports |
| Feature A imports feature B | can't delete or move either | lift to shared or compose in the route |
| Shared component imports a domain hook | shared now depends on a feature | pass data via props; or make it a feature component |
| Business rules in JSX / `page.tsx` | untestable without rendering, duplicated | domain function + hook |
| `fetch` in a component | bypasses the cache, parsing and error handling | data layer |
| Abstraction with one consumer | shaped around one caller | inline until the second consumer |
| Two parallel conventions in one repo | readers can't predict locations | follow the existing one or migrate deliberately |
| 5+ levels of nesting | paths become the documentation | flatten; it's probably a feature |

## Architecture review checklist

Use when reviewing a PR or auditing a frontend:
- [ ] New code lives at the narrowest scope that has all its consumers.
- [ ] Nothing was promoted to shared with only one consumer.
- [ ] No imports against the direction `shared → features → app`; no feature-to-feature imports.
- [ ] Components contain no business rules; page/route files are thin.
- [ ] No direct `fetch` in components; responses are parsed at the boundary.
- [ ] Server data isn't copied into local state; URL state is in the URL.
- [ ] Constants/types live with their domain; no new catch-all files.
- [ ] No new barrel files; file and folder names follow the repo's existing case.
- [ ] (Next.js) server/client split is deliberate; server actions validate input and auth.

## Reference files

- [references/project-structure.md](references/project-structure.md) — folder trees for small, feature-based and Next.js App Router apps; naming conventions. Read when setting up or restructuring a project.
- [references/business-logic-layers.md](references/business-logic-layers.md) — layer responsibilities with before/after refactors. Read when extracting logic from components.
- [references/data-layer.md](references/data-layer.md) — API client, schema parsing, `queryOptions` factories, mutations, error placement. Read when adding or reorganizing data access.
- [references/nextjs-architecture.md](references/nextjs-architecture.md) — App Router colocation, server/client split, DAL/DTO, server actions. Read for any Next.js structure decision.
- [references/import-boundaries.md](references/import-boundaries.md) — lint configs that enforce dependency direction. Read when adding enforcement.

Sources and the reasoning behind contested choices: [README.md](README.md).
