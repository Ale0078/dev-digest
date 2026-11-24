# frontend-ui-architecture

**Version:** 1.0.0 · **Scope:** Frontend (React, Next.js App Router) · **Status:** draft, pending human review

Frontend UI architecture and code organization: where components, hooks, constants, types, helpers, API calls and business logic live; how to split components; dependency direction and import boundaries; the Next.js server/client split as an architectural decision.

Deliberately **not** covered (to avoid duplication): hook/effect/memo rules, keys, conditional rendering → `react-best-practices`; Next.js special files, directive mechanics, metadata, images, fonts → `next-best-practices`; rendering performance in general. Where `react-best-practices` says "shared utilities go in `utils/`", this skill's narrower guidance (domain-named `lib/` modules, no junk-drawer `utils/`) takes precedence for organization questions.

## Changelog

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-11-24 | Initial version, built from the sources below (researched and fetched Nov 2026) |

## Files

| File | Contents |
|---|---|
| `SKILL.md` | Core principles, "where does this go?" table, components, constants, helpers/lib, business logic, state placement, data layer, Next.js summary, imports, anti-patterns, review checklist |
| `references/project-structure.md` | Folder trees (small, feature-based, Next.js App Router), naming, migration |
| `references/business-logic-layers.md` | Layer responsibilities, before/after refactors, how far to go |
| `references/data-layer.md` | API client, parse at boundary, `queryOptions` factories, mutations, error placement |
| `references/nextjs-architecture.md` | `app/` as routing layer, colocation, server/client split, data-access approaches, Server Actions |
| `references/import-boundaries.md` | Lint configs for dependency direction, barrel alternatives, rollout |

## Decisions where sources disagree

| Topic | Positions in sources | Decision in this skill | Why |
|---|---|---|---|
| Barrel files (`index.ts`) | Against: TkDodo, Hagemeister, Atlassian, bulletproof-react (reversed earlier advice), Wieruch. For a public-API index: FSD, Comeau, freeCodeCamp | No barrels in app code; `index.ts` only for real packages | Cycles, slower dev/test/typecheck, no real encapsulation; public surface can be enforced by lint instead |
| `utils` vs `helpers` vs `lib` | Comeau: helpers = project-specific, utils = generic. bulletproof: lib = preconfigured libraries, utils = shared functions. FSD: `lib` = slice-internal helpers. Next.js: names have no meaning | `helpers.ts` colocated; shared code in domain-named `lib/<domain>.ts`; generic `utils/` only for project-agnostic functions, never a junk drawer | Every source agrees on "don't promote before a second consumer"; domain names force a placement decision |
| File/folder case | kebab-case: bulletproof, Wieruch, TkDodo. PascalCase component folders: Comeau | Follow the repo's existing convention, lint-enforce it | Consistency matters more than the choice |
| Hook per query vs `queryOptions` | TkDodo 2021–22 and bulletproof: custom hook per query. TkDodo 2024/2026 and TanStack docs: `queryOptions` as base | `queryOptions` factories per domain; hooks optional, built on top | Works outside components, keeps key + fetcher together, no variant lock-in |
| Layered/clean architecture vs simplicity | For layers: Fowler-site articles, Bespoyasov, Stemmler. Against premature abstraction: Abramov, Dodds (AHA, colocation), Wieruch | Pure domain layer + one-way dependencies as minimum; full clean architecture only with a concrete reason | Bespoyasov himself names the cost; the minimum gives testability without ceremony |
| Container/presentational | Abramov (2019 note) and patterns.dev: replaced by hooks. Fowler-site: view + hook as view-model | Hook holds logic, component renders; no mandatory container files | Same separation, fewer files |
| Where routes live in Next.js | Next.js docs, freeCodeCamp: colocate in `app/` with `_folders`. FSD: `app/` as re-exports, pages in `src/_pages` | Next.js colocation model | Matches the framework; FSD's variant fights `app/` |
| Feature vs type folders | Feature-based: bulletproof, FSD, Wieruch, freeCodeCamp. By type: Comeau. React FAQ: either | Start by type when small, move to features as domains grow | Both work; the trigger is when one domain's code scatters |
| Copy server data into state | Forbidden: TkDodo, react.dev, Dodds. Exception: forms (TkDodo) | Never, except form drafts initialised from server data | |
| Parse every response | Alexis King: always at boundaries. TkDodo: yes, but mind runtime cost and over-strict schemas | Parse in the data layer with tolerant schemas | |

## Sources

Tags: **[O]** official docs · **[R]** canonical repo / methodology · **[E]** expert blog · **[C]** community. ⚠ = not fully verified.
All URLs were fetched in November 2026 unless marked ⚠.

### 1. Project structure: official
- [O] Next.js — *Project structure and organization*: unopinionated; colocation in `app/` is safe, `_private` folders, `(groups)`, three structuring strategies, "pick one and be consistent". https://nextjs.org/docs/app/getting-started/project-structure
- [O] Next.js — *optimizePackageImports*: loads only used modules from barrel-heavy packages; for packages, not app code. https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports
- [O] React (legacy docs) — *File Structure FAQ*: group by feature or type, ≤3–4 nesting levels, don't overthink it. https://legacy.reactjs.org/docs/faq-structure.html
- [C] *react-file-structure* (joke page linked from Dan Abramov): "move files around until it feels right". https://react-file-structure.surge.sh/

### 2. Reference architectures
- [R] bulletproof-react — *Project Structure*: `src/{app,components,config,features,hooks,lib,stores,testing,types,utils}`, feature folders, no cross-feature imports, shared → features → app via `import/no-restricted-paths`, barrels discouraged. https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- [R] bulletproof-react — *Project Standards*: `@/*` alias, kebab-case via `eslint-plugin-check-file`. https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md
- [R] bulletproof-react — *Components and Styling*: colocate, extract components instead of nested render functions. https://github.com/alan2207/bulletproof-react/blob/master/docs/components-and-styling.md
- [R] bulletproof-react — *API Layer*: one preconfigured client; each request = schema + fetcher + hook. https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md
- [R] Feature-Sliced Design — *Overview*: layers app → pages → widgets → features → entities → shared; slices; segments `ui/api/model/lib/config`; import only from lower layers. https://feature-sliced.design/docs/get-started/overview
- [R] FSD — *Public API*: `index.ts` per slice, avoid `export *`, admits bundler issues with barrels. https://feature-sliced.design/docs/reference/public-api
- [R] FSD — *Usage with Next.js*: `app/` as thin re-exports, `_app`/`_pages` layers, `index.server.ts`. https://feature-sliced.design/docs/guides/tech/with-nextjs

### 3. Colocation, component organization, constants, types
- [E] Kent C. Dodds — *Colocation*: "place code as close to where it's relevant as possible". https://kentcdodds.com/blog/colocation
- [E] Robin Wieruch — *React Folder Structure [2026]*: component folders, kebab-case, `constants.ts`/`config/`, utils promoted on second consumer, features don't import each other, barrels discouraged. https://www.robinwieruch.de/react-folder-structure/
- [E] Josh W. Comeau — *Delightful React File/Directory Structure*: PascalCase component folders with forwarding `index`, helpers vs utils distinction, `constants.ts`. https://www.joshwcomeau.com/react/file-structure/
- [C] Abisoye Alli-Balogun (freeCodeCamp) — *Reusable Architecture for Large Next.js Applications* (2026): route colocation, lift on second route, `features/<domain>/`, "shared/ has zero knowledge of any feature". https://www.freecodecamp.org/news/reusable-architecture-for-large-nextjs-applications/
- [E] Matt Pocock — *Where To Put Your Types in Application Code*: inline single-use types, `*.types.ts` at the narrowest common folder, packages for cross-package types. https://www.totaltypescript.com/where-to-put-your-types-in-application-code
- [O] next-intl — *Messages*: namespaces nested by component (`useTranslations('auth.SignUp')`). https://next-intl.dev/docs/usage/messages

### 4. utils / helpers and premature abstraction
- [C] *What's that smell? The utils module* (2023): `utils` defers the placement decision and grows into core logic. https://rockstar.github.io/whats-that-smell-the-utils-module.html
- ⚠ [C] *Your utils folder is a crime scene* (dev.to, not opened). https://dev.to/nurrehman/your-utils-folder-is-a-crime-scene-5095
- ⚠ [C] *Utils files are not so useful and helper classes are not so helpful* (dev.to, not opened). https://dev.to/dvddpl/utils-files-are-not-so-useful-and-helper-classes-are-not-so-helpful-1kfn
- [E] Dan Abramov — *The WET Codebase*: some duplication beats the wrong abstraction. https://overreacted.io/the-wet-codebase/
- [E] Dan Abramov — *Goodbye, Clean Code*: optimise for change, "let clean code guide you, then let it go". https://overreacted.io/goodbye-clean-code/
- [E] Kent C. Dodds — *AHA Programming*: avoid hasty abstractions. https://kentcdodds.com/blog/aha-programming

### 5. Barrel files and import boundaries
- [O] Shu Ding (Vercel) — *How we optimized package imports in Next.js*: cost of barrels in packages, origin of `optimizePackageImports`. https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
- [E] TkDodo — *Please Stop Using Barrel Files*: cycles, slow dev startup, no real encapsulation; only valid as a library entry point. https://tkdodo.eu/blog/please-stop-using-barrel-files
- [E] Marvin Hagemeister — *Speeding up the JavaScript ecosystem, part 7: The barrel file debacle*: measured module-graph costs. https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/
- [C] Atlassian Engineering — *Faster builds when removing barrel files* (2025): Jira codemod, CI and test-selection wins, trade-offs. https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files
- [O] eslint-plugin-import — *no-restricted-paths*: `zones` with `target`/`from`/`except`. https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md
- ⚠ [R] eslint-plugin-boundaries: element types + allowed dependencies; v7 rule names differ from older posts (`boundaries/dependencies`), other rule names not confirmed. https://github.com/javierbrea/eslint-plugin-boundaries
- ⚠ [R] JS Boundaries docs and playground (current docs for the plugin). https://www.jsboundaries.dev

### 6. Business logic and layering
- ⚠ [E] Dan Abramov — *Presentational and Container Components* (2015, 2019 note: "I don't suggest splitting your components like this anymore"; page returned 403, wording confirmed via secondary sources). https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0
- [C] patterns.dev (Lydia Hallie, Addy Osmani) — *Container/Presentational Pattern*: largely replaced by hooks; overkill for small apps. https://www.patterns.dev/react/presentational-container-pattern
- [E] Juntao Qiu (martinfowler.com) — *Modularizing React Applications with Established UI Patterns*: view / view-model hook / domain / gateway; strategy objects; "the React view is only one consumer". https://martinfowler.com/articles/modularizing-react-apps.html
- [E] Juntao Qiu (martinfowler.com) — *Headless Component*: behaviour in a hook, rendering separate. https://martinfowler.com/articles/headless-component.html
- [E] Alex Bespoyasov — *Clean Architecture on Frontend*: domain / application / adapters, inward dependencies; candid about costs. https://bespoyasov.me/blog/clean-architecture-on-frontend/
- ⚠ [E] Khalil Stemmler — *Client-Side Architecture Basics* (only the introduction verified; low priority). https://khalilstemmler.com/articles/client-side-architecture/introduction/
- [O] react.dev — *Reusing Logic with Custom Hooks*: hooks share logic not state; `use` prefix only for hook-calling functions; name by purpose. https://react.dev/learn/reusing-logic-with-custom-hooks
- [E] Kent C. Dodds — *Compound Components with React Hooks*: context + guarding hook. https://kentcdodds.com/blog/compound-components-with-react-hooks
- [C] patterns.dev — *Compound Pattern*: context-based vs `Children.map` pitfalls. https://www.patterns.dev/react/compound-pattern
- [E] Kent C. Dodds — *Inversion of Control*: let callers supply behaviour instead of adding options. https://kentcdodds.com/blog/inversion-of-control

### 7. State placement
- [O] react.dev — *You Might Not Need an Effect*: derive during render, logic in event handlers, effects only for external systems. https://react.dev/learn/you-might-not-need-an-effect
- [O] react.dev — *Choosing the State Structure*: group related, avoid contradictions, redundancy, duplication, deep nesting. https://react.dev/learn/choosing-the-state-structure
- [E] Kent C. Dodds — *Application State Management with React*: server cache vs UI state, colocate, composition before context. https://kentcdodds.com/blog/application-state-management-with-react
- [E] Kent C. Dodds — *Don't Sync State. Derive It!* https://kentcdodds.com/blog/dont-sync-state-derive-it
- [E] TkDodo — *Don't over useState*. https://tkdodo.eu/blog/dont-over-use-state
- [C] nuqs — type-safe URL search-param state. https://nuqs.dev/

### 8. Data layer (TanStack Query) and validation at the boundary
- [E] TkDodo — *Practical React Query* (series index). https://tkdodo.eu/blog/practical-react-query
- [E] TkDodo — *Effective React Query Keys*: key factories per feature, generic → specific, colocated. https://tkdodo.eu/blog/effective-react-query-keys
- [E] TkDodo — *The Query Options API* (2024): keep key and `queryFn` together in `queryOptions`. https://tkdodo.eu/blog/the-query-options-api
- [E] TkDodo — *Creating Query Abstractions* (2026): `queryOptions` as base abstraction, hooks optional on top. https://tkdodo.eu/blog/creating-query-abstractions
- [O] TanStack — *Query Options guide*. https://tanstack.com/query/latest/docs/framework/react/guides/query-options
- [E] TkDodo — *Mastering Mutations in React Query*: invalidation in `useMutation`, UI reactions in `mutate` callbacks. https://tkdodo.eu/blog/mastering-mutations-in-react-query
- [E] TkDodo — *Automatic Query Invalidation after Mutations*: global `MutationCache` + `meta`. https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations
- [O] TanStack — *Does TanStack Query replace Redux/global state?*: server state in Query, remaining client state is small. https://tanstack.com/query/latest/docs/framework/react/guides/does-this-replace-client-state
- [E] TkDodo — *React Query and Forms*: the exception to "don't copy server state". https://tkdodo.eu/blog/react-query-and-forms
- [E] TkDodo — *Type-safe React Query*: `schema.parse` in `queryFn`, tolerant schemas. https://tkdodo.eu/blog/type-safe-react-query
- [E] TkDodo — *React Query Error Handling*: local `error`, `throwOnError` → boundaries, global `QueryCache.onError`. https://tkdodo.eu/blog/react-query-error-handling
- [E] TkDodo — *You Might Not Need React Query*: RSC frameworks reduce the need; hybrid for polling/infinite/offline. https://tkdodo.eu/blog/you-might-not-need-react-query
- [O] TanStack — *Advanced Server Rendering (App Router)*: per-request QueryClient, prefetch + `HydrationBoundary`. https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
- [E] Alexis King — *Parse, don't validate*: parse untrusted input once at the boundary into precise types. https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/

### 9. Next.js App Router: where logic lives
- [O] Next.js — *Data Security*: HTTP API vs DAL vs component-level; DAL is `server-only`, returns DTOs; Server Actions as public endpoints. https://nextjs.org/docs/app/guides/data-security
- [O] Sebastian Markbåge (Next.js blog) — *How to Think About Security in Next.js*: origin of DAL/DTO model. https://nextjs.org/blog/security-nextjs-server-components-actions
- [O] Next.js — *Server and Client Components*: `'use client'` on leaves, serializable props, `children` interleaving, `server-only`. https://nextjs.org/docs/app/getting-started/server-and-client-components
- [O] Next.js — *Fetching Data*. https://nextjs.org/docs/app/getting-started/fetching-data
- [O] Next.js — *Mutating Data*. https://nextjs.org/docs/app/getting-started/mutating-data
- [O] Next.js — *Server Actions and Mutations guide*: send IDs, re-check ownership, not for fetching. https://nextjs.org/docs/app/guides/server-actions
- [E] Josh W. Comeau — *Making Sense of React Server Components*: client boundary spreads through imports; ownership matters. https://www.joshwcomeau.com/react/server-components/
