#!/usr/bin/env node
// Deterministic checks for the packages the diff touches: typecheck + related unit tests.
// Prints JSON { checks: [{ pkg, kind, status: pass|fail|skipped, cmd, reason?, log?, tail? }] }.
// Exit 0 = nothing failed, 1 = at least one check failed. Full logs go to <git-dir>/pr-self-review-logs/.
// Usage: node checks.mjs [--base main] [--no-tests]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { diffState, parseArgs, repoRoot, statePath } from './lib.mjs';

const PACKAGES = {
  server: { pm: 'pnpm', testExclude: ['**/*.it.test.ts'] }, // *.it.test.ts need Postgres (Testcontainers)
  client: { pm: 'pnpm', testExclude: [] },
  'reviewer-core': { pm: 'npm', testExclude: [] },
  e2e: { pm: 'npm', tests: false }, // browser flows on seeded data — never run here
};

const CODE = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/;
const TYPE_INPUT = /(\.(ts|tsx|mts|cts)$|(^|\/)tsconfig[^/]*\.json$|(^|\/)package\.json$)/;

const args = parseArgs(process.argv.slice(2));
const root = repoRoot();
const state = diffState(root, args.base || 'main');

// Which packages need a typecheck, and which source files feed `vitest related`.
const typecheck = new Set();
const related = Object.fromEntries(Object.keys(PACKAGES).map((p) => [p, []]));
for (const { status, path } of state.files) {
  const pkg = path.split('/')[0];
  if (!(pkg in PACKAGES) || !TYPE_INPUT.test(path)) continue;
  typecheck.add(pkg);
  // Cross-package aliases: server type-checks ../reviewer-core/src; reviewer-core aliases server/src/vendor/shared.
  if (pkg === 'reviewer-core') typecheck.add('server');
  if (path.startsWith('server/src/vendor/shared/')) typecheck.add('reviewer-core');
  if (status !== 'D' && CODE.test(path)) related[pkg].push(path.slice(pkg.length + 1));
}

const logDir = statePath(root, 'logs');
mkdirSync(logDir, { recursive: true });

function run(pkg, kind, cmd, argv) {
  const cwd = join(root, pkg);
  const label = `${cmd} ${argv.join(' ')}`;
  if (!existsSync(join(cwd, 'node_modules')))
    return Promise.resolve({ pkg, kind, status: 'skipped', cmd: label, reason: `deps not installed (${PACKAGES[pkg].pm} install in ${pkg}/)` });
  return new Promise((done) => {
    const child = spawn(cmd, argv, { cwd, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (e) => done({ pkg, kind, status: 'skipped', cmd: label, reason: e.message }));
    child.on('close', (code) => {
      const log = join(logDir, `${pkg}-${kind}.log`);
      writeFileSync(log, out);
      const tail = out.trim().split('\n').slice(-40).join('\n');
      done({ pkg, kind, status: code === 0 ? 'pass' : 'fail', cmd: label, log, ...(code === 0 ? {} : { tail }) });
    });
  });
}

const jobs = [];
for (const pkg of typecheck) jobs.push(run(pkg, 'typecheck', PACKAGES[pkg].pm, ['run', '--silent', 'typecheck']));
if (!args['no-tests']) {
  for (const [pkg, files] of Object.entries(related)) {
    if (!files.length || PACKAGES[pkg].tests === false) continue;
    const exclude = PACKAGES[pkg].testExclude.flatMap((g) => ['--exclude', g]);
    jobs.push(
      run(pkg, 'tests', join('node_modules', '.bin', 'vitest'), ['related', '--run', '--passWithNoTests', ...exclude, ...files]),
    );
  }
}

const checks = await Promise.all(jobs);
process.stdout.write(JSON.stringify({ checks }, null, 2) + '\n');
process.exit(checks.some((c) => c.status === 'fail') ? 1 : 0);
