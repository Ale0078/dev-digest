import { describe, it, expect } from 'vitest';
import { SmartDiffResponse, type SmartDiffRole } from '@devdigest/shared';
import { buildSmartDiff, classifyFile } from '../src/modules/smart-diff/classify.js';

const TABLE: [SmartDiffRole, string[]][] = [
  [
    'boilerplate',
    [
      'pnpm-lock.yaml',
      'client/pnpm-lock.yaml',
      'package-lock.json',
      'yarn.lock',
      'Cargo.lock',
      'dist/index.js',
      'src/__tests__/__snapshots__/x.snap',
      'src/x.generated.ts',
      'public/app.min.js',
    ],
  ],
  [
    'tests',
    [
      'src/a.test.ts',
      'src/a.test.tsx',
      'server/test/smart-diff.it.test.ts',
      'src/a.spec.ts',
      'server/test/helpers/pg.ts',
      'src/__tests__/a.ts',
      'e2e/README.md',
      'e2e/specs/05-pr-diff.flow.json',
    ],
  ],
  [
    'wiring',
    [
      'server/src/modules/index.ts',
      'client/vitest.config.ts',
      'tsconfig.json',
      'client/tsconfig.base.json',
      '.eslintrc.cjs',
      '.env.example',
      'docker-compose.yml',
      '.github/workflows/ci.yml',
      '.claude/skills/security/SKILL.md',
    ],
  ],
  ['docs', ['README.md', 'docs/agent-prompts/x.md', 'server/README.md', 'CHANGELOG.md', 'LICENSE']],
  ['core', ['src/config.ts', 'src/middleware/ratelimit.ts', 'src/latest.ts', 'src/contest/a.ts', '.\\src\\win.ts']],
];

describe('classifyFile', () => {
  const cases = TABLE.flatMap(([role, paths]) => paths.map((p) => [p, role] as const));
  it.each(cases)('%s → %s', (path, role) => {
    expect(classifyFile(path)).toBe(role);
  });
});

describe('buildSmartDiff', () => {
  const files = [
    { path: 'src/b.ts', additions: 3, deletions: 1 },
    { path: 'src/a.ts', additions: 10, deletions: 2 },
    { path: 'pnpm-lock.yaml', additions: 5, deletions: 5 },
  ];

  it('returns all five groups in order, including empty ones, and keeps input order', () => {
    const r = buildSmartDiff(files, []);
    expect(r.groups.map((g) => g.role)).toEqual(['core', 'tests', 'wiring', 'docs', 'boilerplate']);
    expect(r.groups[0]!.files.map((f) => f.path)).toEqual(['src/b.ts', 'src/a.ts']);
    expect(r.groups[1]!.files).toEqual([]);
    expect(r.groups[4]!.files.map((f) => f.path)).toEqual(['pnpm-lock.yaml']);
  });

  it('sorts and dedupes finding lines per file and ignores other files', () => {
    const r = buildSmartDiff(files, [
      { file: 'src/a.ts', start_line: 12 },
      { file: 'src/a.ts', start_line: 5 },
      { file: 'src/a.ts', start_line: 12 },
      { file: 'src/other.ts', start_line: 1 },
    ]);
    const core = r.groups[0]!.files;
    expect(core.find((f) => f.path === 'src/a.ts')!.finding_lines).toEqual([5, 12]);
    expect(core.find((f) => f.path === 'src/b.ts')!.finding_lines).toEqual([]);
  });

  it('computes split_suggestion and validates against the contract', () => {
    const r = buildSmartDiff(files, []);
    expect(r.split_suggestion).toEqual({ too_big: false, total_lines: 26, proposed_splits: [] });
    expect(SmartDiffResponse.safeParse(r).success).toBe(true);
  });
});
