#!/usr/bin/env node
// Records the review verdict for the gate hook.
// Usage: node record.mjs --status PASS|BLOCKED --hash <hash from diff-state> [--base main]
//          [--critical N] [--major N] [--minor N] [--info N]
//
// Inputs written by the orchestrator beforehand, in <git-dir>/ (see diff-state `stateDir`):
//   pr-self-review.md            the report (required) — stamped with the verdict, kept for the PR body
//   pr-self-review-waivers.json  optional, ONLY after explicit user approval:
//                                [{ file, line, skill, rule, reason }] — one per waived critical
//
// PASS requires every critical to be waived (critical === waivers.length). Criticals from
// `checks` (typecheck/tests) and `repo-rules` can never be waived. The waivers file is consumed:
// waivers are moved into the marker and apply to this exact diff only.
// If the diff changed since the review started, records STALE and exits 1.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { diffState, parseArgs, repoRoot, statePath, writeMarker, markerPath } from './lib.mjs';

const UNWAIVABLE = new Set(['checks', 'repo-rules']);
const FOOTER = /\n*<!-- pr-self-review: .* -->\n*$/;

const fail = (msg, code = 64) => {
  console.error(`record.mjs: ${msg}`);
  process.exit(code);
};

const args = parseArgs(process.argv.slice(2));
const status = String(args.status || '').toUpperCase();
if (!['PASS', 'BLOCKED'].includes(status) || typeof args.hash !== 'string')
  fail('usage: record.mjs --status PASS|BLOCKED --hash <hash> [--critical N --major N --minor N --info N]');

const root = repoRoot();
const counts = Object.fromEntries(['critical', 'major', 'minor', 'info'].map((k) => [k, Number(args[k] || 0)]));

// Waivers
const waiversPath = statePath(root, 'waivers');
let waivers = [];
if (existsSync(waiversPath)) {
  try {
    waivers = JSON.parse(readFileSync(waiversPath, 'utf8'));
  } catch (e) {
    fail(`${waiversPath} is not valid JSON (${e.message})`);
  }
  if (!Array.isArray(waivers)) fail('waivers must be a JSON array');
  for (const w of waivers) {
    if (!w.file || !w.rule || !w.skill) fail(`waiver needs file, skill, rule: ${JSON.stringify(w)}`);
    if (UNWAIVABLE.has(w.skill)) fail(`${w.skill} findings cannot be waived (${w.file}:${w.line ?? ''})`);
    if (typeof w.reason !== 'string' || w.reason.trim().length < 10)
      fail(`waiver for ${w.file}:${w.line ?? ''} needs a real reason (≥10 chars)`);
  }
}
if (waivers.length > counts.critical) fail(`${waivers.length} waivers but only ${counts.critical} critical findings`);
if (status === 'PASS' && counts.critical > waivers.length)
  fail(`PASS with ${counts.critical - waivers.length} unwaived critical finding(s) is not allowed`);

// Report
const reportPath = statePath(root, 'report');
if (!existsSync(reportPath)) fail(`write the report to ${reportPath} first`);

const state = diffState(root, args.base || 'main');
const stale = state.hash !== args.hash;
const finalStatus = stale ? 'STALE' : status;
const recordedAt = new Date().toISOString();

const report = readFileSync(reportPath, 'utf8').replace(FOOTER, '');
writeFileSync(
  reportPath,
  `${report.trimEnd()}\n\n<!-- pr-self-review: ${finalStatus} hash=${args.hash.slice(0, 12)} at=${recordedAt} -->\n`,
);

writeMarker(root, {
  status: finalStatus,
  hash: args.hash,
  base: state.base,
  head: state.head,
  counts,
  waivers: waivers.map((w) => ({ ...w, approvedBy: 'user' })),
  report: reportPath,
  recordedAt,
});
rmSync(waiversPath, { force: true });

if (stale) fail('changes were made during the review — recorded STALE. Re-run /pr-self-review.', 1);
console.log(
  `recorded ${status}${waivers.length ? ` (${waivers.length} waived critical)` : ''} → ${markerPath(root)}`,
);
