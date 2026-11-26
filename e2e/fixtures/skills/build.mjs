#!/usr/bin/env node
/**
 * Rebuild the skill import fixtures from their sources:
 *   flaky-test-patterns/  ->  flaky-test-patterns.zip
 *
 * Run from anywhere: `node e2e/fixtures/skills/build.mjs`. Uses the system `zip`
 * CLI (preinstalled on macOS and most Linux images; `apt-get install zip`
 * otherwise) so e2e needs no new dependency. `-X` drops extra file attributes
 * and the zip is rebuilt from scratch, so the archive only holds the sources.
 * Entry timestamps follow the files' mtimes, so a rebuild changes the zip bytes.
 * Commit the rebuilt zip together with any change to its sources.
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

for (const name of ['flaky-test-patterns']) {
  const out = join(here, `${name}.zip`);
  rmSync(out, { force: true });
  // Entries are stored relative to the skill folder: SKILL.md sits at the zip root.
  // `-D`: no directory entries, so the zip lists only files (SKILL.md, scripts/run.sh).
  execFileSync('zip', ['-r', '-X', '-D', '-q', out, '.', '-x', '.DS_Store', '*/.DS_Store'], {
    cwd: join(here, name),
    stdio: 'inherit',
  });
  execFileSync('unzip', ['-l', out], { stdio: 'inherit' });
}
