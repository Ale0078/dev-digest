import type { SmartDiffRole } from '@devdigest/shared';

/** Display order of the role groups on the Files changed tab. */
export const SMART_DIFF_ROLE_ORDER: readonly SmartDiffRole[] = [
  'core',
  'tests',
  'wiring',
  'docs',
  'boilerplate',
];

/** The pre-normalised parts of a repo path that matchers work on (never a whole-path substring test). */
export interface PathParts {
  segments: string[];
  dirs: string[];
  base: string;
}

export interface ClassifyRule {
  role: SmartDiffRole;
  matchers: ((p: PathParts) => boolean)[];
}

const LOCK_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']);
const TEST_DIRS = new Set(['test', 'tests', '__tests__']);

/**
 * Rules in check order: boilerplate → tests → wiring → docs; `core` is the
 * fallback when nothing matches. Add a matcher here, and a row to
 * `test/smart-diff-classify.test.ts`, to teach the classifier a new path.
 */
export const CLASSIFY_RULES: readonly ClassifyRule[] = [
  {
    role: 'boilerplate',
    matchers: [
      (p) => p.base.endsWith('.lock'),
      (p) => LOCK_FILES.has(p.base),
      (p) => p.segments[0] === 'dist' || p.segments[0] === 'build',
      (p) => p.dirs.includes('__snapshots__'),
      (p) => p.base.endsWith('.snap'),
      (p) => /\.generated\./.test(p.base),
      (p) => p.base.endsWith('.min.js'),
    ],
  },
  {
    role: 'tests',
    matchers: [
      (p) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(p.base),
      (p) => p.dirs.some((d) => TEST_DIRS.has(d)),
      (p) => p.segments[0] === 'e2e',
    ],
  },
  {
    role: 'wiring',
    matchers: [
      (p) => p.base === 'index.ts' || p.base === 'index.js',
      (p) => /\.config\./.test(p.base),
      (p) => /^tsconfig.*\.json$/.test(p.base),
      (p) => p.base.startsWith('.eslintrc') || p.base.startsWith('.env'),
      (p) => /^docker-compose.*\.ya?ml$/.test(p.base),
      (p) => p.segments[0] === '.github' || p.segments[0] === '.claude',
    ],
  },
  {
    role: 'docs',
    matchers: [
      (p) => p.base.endsWith('.md'),
      (p) => p.segments[0] === 'docs',
      (p) => p.base.startsWith('README') || p.base.startsWith('CHANGELOG'),
      (p) => p.base === 'LICENSE',
    ],
  },
];
