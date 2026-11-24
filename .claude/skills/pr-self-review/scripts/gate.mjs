#!/usr/bin/env node
// Claude Code PreToolUse hook (matcher: Bash). Blocks `gh pr create` / `gh pr merge`
// unless the last /pr-self-review recorded PASS for exactly the current diff.
// Exit 0 = allow, exit 2 = block (stderr is shown to Claude).
import { diffState, readMarker, repoRoot } from './lib.mjs';

// Only at a command position (start, or after ; & | ( newline `$(`, optionally behind
// env assignments), so a quoted mention like `echo "gh pr create"` is not gated.
const GATED = /(?:^|[;&|(\n]|\$\()\s*(?:\w+=\S*\s+)*gh\s+pr\s+(?:create|merge)\b/;

let input = '';
for await (const chunk of process.stdin) input += chunk;

let command = '';
try {
  command = JSON.parse(input)?.tool_input?.command ?? '';
} catch {
  process.exit(0);
}
// Drop heredoc bodies and quoted strings first: text *about* `gh pr create` is not a call.
// (Known gap: `bash -c "gh pr create"` is not gated — this guards against accidents, not evasion.)
const executable = command
  .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g, '')
  .replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, "''");
if (!GATED.test(executable)) process.exit(0);

const block = (msg) => {
  console.error(`PR Self Review gate: ${msg}`);
  process.exit(2);
};

let root, state;
try {
  root = repoRoot(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  state = diffState(root);
} catch (e) {
  block(`could not compute the diff (${e.message}). Run /pr-self-review.`);
}

const marker = readMarker(root);
if (!marker) block('no review recorded for these changes. Run /pr-self-review first.');
if (marker.hash !== state.hash)
  block('changes differ from the last reviewed state. Run /pr-self-review again.');
if (marker.status === 'STALE') block('last review is stale. Run /pr-self-review again.');
if (marker.status !== 'PASS')
  block(
    `last review is ${marker.status} with ${marker.counts?.critical ?? '?'} critical finding(s). ` +
      'Fix them and re-run /pr-self-review. Do not bypass this gate.',
  );
process.exit(0);
