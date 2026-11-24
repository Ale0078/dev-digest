// Shared helpers for pr-self-review: diff state, hashing, marker I/O.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();

const tryGit = (args, cwd) => {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
};

export function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd);
}

/** All pr-self-review state lives in the git dir: never committed, per-worktree. */
export function stateDir(root) {
  return resolve(root, git(['rev-parse', '--git-dir'], root));
}

export const STATE_FILES = {
  marker: 'pr-self-review.json',
  report: 'pr-self-review.md',
  waivers: 'pr-self-review-waivers.json',
  cache: 'pr-self-review-cache.json',
  logs: 'pr-self-review-logs',
};

export function statePath(root, name) {
  return join(stateDir(root), STATE_FILES[name]);
}

export function markerPath(root) {
  return statePath(root, 'marker');
}

export async function readStdin() {
  let s = '';
  for await (const chunk of process.stdin) s += chunk;
  return s;
}

/** merge-base of HEAD with the base branch; falls back to origin/<base>. */
export function resolveBase(root, base = 'main') {
  for (const ref of [base, `origin/${base}`]) {
    const mb = tryGit(['merge-base', ref, 'HEAD'], root);
    if (mb) return { ref, sha: mb };
  }
  throw new Error(`pr-self-review: cannot find merge-base with "${base}" or "origin/${base}"`);
}

/**
 * Everything the PR would contain: working tree vs merge-base, plus untracked files.
 */
export function diffState(root, base = 'main') {
  const { ref, sha } = resolveBase(root, base);
  const nameStatus = git(['diff', '--name-status', '--no-renames', sha], root);
  const untracked = git(['ls-files', '--others', '--exclude-standard'], root)
    .split('\n')
    .filter(Boolean);

  const files = nameStatus
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, path] = line.split('\t');
      return { status, path };
    })
    .concat(untracked.map((path) => ({ status: '?', path })))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // Hash path + current content (not the git status), so staging, committing, or
  // committing a previously untracked file keeps the hash unchanged.
  const h = createHash('sha256').update(`base:${sha}\0`);
  for (const { path } of files) {
    const abs = join(root, path);
    h.update(`\0${path}\0`);
    h.update(existsSync(abs) ? readFileSync(abs) : '\0<deleted>\0');
  }

  return {
    base: ref,
    baseSha: sha,
    head: git(['rev-parse', 'HEAD'], root),
    stateDir: stateDir(root),
    files,
    hash: files.length ? h.digest('hex') : 'empty',
  };
}

export function readMarker(root) {
  const p = markerPath(root);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function writeMarker(root, data) {
  writeFileSync(markerPath(root), JSON.stringify(data, null, 2) + '\n');
}

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith('--') ? (i++, next) : true;
  }
  return out;
}
