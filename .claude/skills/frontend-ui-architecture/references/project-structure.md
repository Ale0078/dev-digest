# Project structure

Folder layouts that apply the principles in `SKILL.md`. Pick the smallest one that fits and grow into the next; don't start a 5-file app with ten top-level folders.

## Contents
1. Small app (flat, by type)
2. Medium/large app (feature-based)
3. Next.js App Router
4. Naming conventions
5. Growing and migrating

## 1. Small app (flat, by type)

Fine for a handful of screens. Group by type, colocate inside each component folder.

```
src/
├── components/
│   ├── Header/
│   │   ├── Header.tsx
│   │   └── Header.test.tsx
│   └── TodoList/
│       ├── TodoList.tsx
│       ├── TodoItem.tsx      # private sub-component
│       └── helpers.ts
├── hooks/
├── lib/                      # api client, domain modules
├── config/
└── App.tsx
```

Move to feature folders when `components/` holds components of several unrelated domains and you can no longer tell which ones belong together.

## 2. Medium/large app (feature-based)

```
src/
├── app/                      # app shell: providers, router/routes, global styles
├── components/               # shared UI: no domain knowledge, data via props
├── config/                   # validated env + app settings
├── features/
│   ├── reviews/
│   │   ├── api/              # queryOptions factories, fetchers, schemas, mutations
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/              # domain logic: pure functions, constants, types
│   │   └── types.ts
│   └── repos/
│       └── …                 # only the subfolders it needs
├── hooks/                    # generic hooks (useMediaQuery, useDebounce)
├── lib/                      # cross-feature domain modules + preconfigured libraries
├── testing/                  # test utilities, mocks
└── types/                    # only truly global types (rare)
```

Rules:
- A feature folder contains only what it uses; empty `hooks/` or `types/` folders are noise.
- Features never import from each other. Routes/app compose features.
- `components/` and `lib/` never import from `features/`.
- A central `lib/api` client is fine even with feature folders: transport is shared, endpoints/queries belong to features.

Feature-Sliced Design is a stricter, standardized version of this idea (layers `app → pages → widgets → features → entities → shared`, slices per domain, segments `ui/api/model/lib/config`). Consider it for large teams that want a documented methodology and its linter; it adds ceremony and, in Next.js, fights the `app/` directory (it needs renamed `_app`/`_pages` layers).

## 3. Next.js App Router

Routes and route-only code inside `app/`, everything shared outside it.

```
src/
├── app/
│   ├── layout.tsx
│   ├── (marketing)/              # route group: shared layout, no URL segment
│   │   └── page.tsx
│   └── repos/
│       └── [repoId]/
│           ├── page.tsx          # thin: params → compose features
│           ├── _components/      # private folder: not routable, route-only UI
│           │   └── RepoHeader/
│           └── pulls/
│               ├── page.tsx
│               └── _components/
│                   └── PRRow/
├── components/                   # shared UI
├── features/ (optional)          # domain code used by several routes
├── lib/                          # api client, query client, domain modules
└── config/
```

- Only `page.*` and `route.*` make a segment public, so colocating other files in `app/` is safe. `_folders` make the intent explicit and keep future Next.js conventions from colliding with your names.
- When a `_components/<Name>` is needed by a second route, move it up to the nearest common ancestor's `_components/`, then to `components/` or `features/<f>/components/` if routes in different branches need it.
- If the app is small, `lib/` + `components/` without `features/` is enough; add `features/` when one domain's code spreads across several routes.

## 4. Naming conventions

Sources disagree on case; what matters is one rule, written down and ideally lint-enforced (`eslint-plugin-check-file` or `unicorn/filename-case`).

| Thing | Common choice A | Common choice B |
|---|---|---|
| Component folder + file | `FindingCard/FindingCard.tsx` (PascalCase) | `finding-card/finding-card.tsx` (kebab-case) |
| Hook file | `useFindings.ts` | `use-findings.ts` |
| Non-component module | `review-status.ts` | `review-status.ts` |
| Collection files | `helpers.ts`, `constants.ts`, `types.ts` (plural) | same |

- Follow whatever the repository already uses. Mixed case in one codebase is worse than either choice.
- Prefer named exports: they keep names consistent across imports and make renames greppable. (Next.js route files require default exports — that's a framework exception.)
- Name files after what they contain (`FindingCard.tsx`), not `index.tsx`, so editor tabs and stack traces are readable.

## 5. Growing and migrating

- Restructure in small moves that each keep the app building: move one feature at a time, update imports, commit.
- Moving code up a tier is a deliberate change — do it in the PR that introduces the second consumer, so the reason is visible.
- When adopting lint boundaries in an existing codebase, start with warnings and a list of known violations, then tighten.
