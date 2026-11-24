#!/usr/bin/env node
// Prints the PR diff state as JSON: { base, baseSha, head, files[{status,path}], hash }.
// Usage: node diff-state.mjs [--base main]
import { diffState, parseArgs, repoRoot } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const root = repoRoot();
process.stdout.write(JSON.stringify(diffState(root, args.base || 'main'), null, 2) + '\n');
