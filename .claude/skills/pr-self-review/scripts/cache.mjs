#!/usr/bin/env node
// Per-reviewer findings cache, so a re-run only re-reviews skills whose inputs changed.
//
//   node cache.mjs get --skill <name> --base <baseSha> -- <file> [<file> …]
//     → { key, hit, findings? }   (key covers: skill, baseSha, files' paths + content, the skill's
//                                   SKILL.md, module CLAUDE.md files, and this skill's brief/severity/routing)
//   node cache.mjs put --skill <name> --key <key>  < findings.json   (JSON array from the reviewer)
//   node cache.mjs clear
//
// Cache file: <git-dir>/pr-self-review-cache.json (never committed).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs, readStdin, repoRoot, statePath } from './lib.mjs';

const MAX_ENTRIES = 300;
const SELF = '.claude/skills/pr-self-review';
const REVIEW_INPUTS = [`${SELF}/references/subagent-prompt.md`, `${SELF}/references/severity.md`, `${SELF}/references/routing.md`];
const MODULES = ['server', 'client', 'reviewer-core', 'e2e'];

const [cmd, ...rest] = process.argv.slice(2);
const sep = rest.indexOf('--');
const args = parseArgs(sep === -1 ? rest : rest.slice(0, sep));
const files = sep === -1 ? [] : rest.slice(sep + 1);

const root = repoRoot();
const cachePath = statePath(root, 'cache');

const load = () => {
  try {
    return JSON.parse(readFileSync(cachePath, 'utf8'));
  } catch {
    return { version: 1, entries: {} };
  }
};

function keyFor(skill, baseSha, paths) {
  const h = createHash('sha256').update(`v1\0${skill}\0${baseSha}\0`);
  const feed = (p) => {
    const abs = join(root, p);
    h.update(`\0${p}\0`);
    h.update(existsSync(abs) ? readFileSync(abs) : '\0<missing>\0');
  };
  const modules = new Set(paths.map((p) => p.split('/')[0]).filter((m) => MODULES.includes(m)));
  [...paths].sort().forEach(feed);
  feed(`.claude/skills/${skill}/SKILL.md`); // `<missing>` for the built-in `correctness` lens
  REVIEW_INPUTS.forEach(feed);
  [...modules].sort().forEach((m) => feed(`${m}/CLAUDE.md`));
  return h.digest('hex');
}

const fail = (msg) => {
  console.error(`cache.mjs: ${msg}`);
  process.exit(64);
};

if (cmd === 'get') {
  if (!args.skill || !args.base || !files.length) fail('usage: get --skill <name> --base <baseSha> -- <files…>');
  const key = keyFor(args.skill, args.base, files);
  const entry = load().entries[key];
  console.log(JSON.stringify(entry ? { key, hit: true, findings: entry.findings } : { key, hit: false }));
} else if (cmd === 'put') {
  if (!args.skill || !args.key) fail('usage: put --skill <name> --key <key> < findings.json');
  let findings;
  try {
    findings = JSON.parse(await readStdin());
  } catch (e) {
    fail(`stdin is not valid JSON (${e.message})`);
  }
  if (!Array.isArray(findings)) fail('findings must be a JSON array');
  const cache = load();
  cache.entries[args.key] = { skill: args.skill, findings, storedAt: new Date().toISOString() };
  const keys = Object.keys(cache.entries).sort((a, b) =>
    cache.entries[a].storedAt < cache.entries[b].storedAt ? 1 : -1,
  );
  for (const k of keys.slice(MAX_ENTRIES)) delete cache.entries[k];
  writeFileSync(cachePath, JSON.stringify(cache) + '\n');
  console.log(`cached ${findings.length} finding(s) for ${args.skill}`);
} else if (cmd === 'clear') {
  rmSync(cachePath, { force: true });
  console.log('cache cleared');
} else {
  fail('commands: get | put | clear');
}
