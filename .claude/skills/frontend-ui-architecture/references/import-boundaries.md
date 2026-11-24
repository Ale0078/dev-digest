# Import boundaries

How to make the dependency direction `shared → features → app` and "no barrels, no cross-feature imports" enforceable instead of aspirational.

## Contents
1. Rules to enforce
2. `import/no-restricted-paths`
3. `eslint-plugin-boundaries`
4. Barrel files: what to do instead
5. Rolling out in an existing codebase

## 1. Rules to enforce

1. Shared code (`components/`, `hooks/`, `lib/`, `config/`) never imports from `features/` or `app/`.
2. `features/*` never import from `app/`.
3. `features/a` never imports from `features/b`.
4. No import cycles.
5. One alias (`@/` → `src/`) for cross-folder imports.

## 2. `import/no-restricted-paths`

Works with plain `eslint-plugin-import`. Zones are matched against resolved file paths.

```js
// eslint.config.js (flat config)
import importPlugin from 'eslint-plugin-import';

export default [
  {
    plugins: { import: importPlugin },
    rules: {
      'import/no-cycle': 'error',
      'import/no-restricted-paths': ['error', {
        zones: [
          // features cannot import each other (one zone per feature)
          { target: './src/features/reviews', from: './src/features', except: ['./reviews'] },
          { target: './src/features/repos',   from: './src/features', except: ['./repos'] },
          // features cannot import the app layer
          { target: './src/features', from: './src/app' },
          // shared cannot import features or app
          {
            target: ['./src/components', './src/hooks', './src/lib', './src/config'],
            from: ['./src/features', './src/app'],
          },
        ],
      }],
    },
  },
];
```

Trade-off: one zone per feature must be kept in sync as features are added.

## 3. `eslint-plugin-boundaries`

Classifies files into element types and declares which types may depend on which — scales better than listing zones. The rule names changed across major versions (v7 uses `boundaries/dependencies`); check the current docs at https://www.jsboundaries.dev before copying a config from older blog posts. Shape of the configuration:

```js
settings: {
  'boundaries/elements': [
    { type: 'app',      pattern: 'src/app/**' },
    { type: 'feature',  pattern: 'src/features/*', capture: ['feature'] },
    { type: 'shared',   pattern: 'src/{components,hooks,lib,config}/**' },
  ],
},
// rule: app → feature, shared; feature → shared and same feature only; shared → shared
```

## 4. Barrel files: what to do instead

- Import the file that defines the thing: `import { FindingCard } from '@/features/reviews/components/FindingCard/FindingCard'`.
- Why not barrels in app code: they create circular imports through `index.ts`, load every module in the folder for one import (dev server, tests, type checking all slow down), and give no real encapsulation — anything can still deep-import.
- If a feature needs an explicit public surface, express it with lint rules (deny deep imports from outside the feature) rather than an `index.ts`.
- An `index.ts` is appropriate as the entry point of an actual package (a library or a vendored shared package).
- Third-party barrels (icon libraries, date-fns) are a bundler concern — Next.js `optimizePackageImports` handles those; it doesn't fix your own barrels.

## 5. Rolling out in an existing codebase

- Start the rules as `warn`, fix or list the violations, then switch to `error`.
- Add `import/no-cycle` early; cycles get harder to untangle over time.
- Add a filename-case rule (`unicorn/filename-case` or `eslint-plugin-check-file`) matching the repo's existing convention.
