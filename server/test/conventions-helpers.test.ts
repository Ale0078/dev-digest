import { describe, it, expect } from 'vitest';
import {
  configCandidatePaths,
  dedupeAgainstAccepted,
  locateSnippet,
  normalizeConfidence,
  ruleKey,
} from '../src/modules/conventions/helpers.js';

const FILE = [
  "import axios from './axiosConfig';",
  '',
  'export const getFromLocalStorage = (key, defaultValue = null) => {',
  '  try {',
  '    const item = localStorage.getItem(key)',
  '',
  '    return item ? JSON.parse(item) : defaultValue',
  '  } catch (e) {',
  '    return defaultValue',
  '  }',
  '}',
].join('\n');

describe('locateSnippet', () => {
  it('finds an exact multi-line snippet and returns its 1-based range', () => {
    expect(locateSnippet(FILE, '  try {\n    const item = localStorage.getItem(key)')).toEqual({
      start: 4,
      end: 5,
    });
  });

  it('tolerates re-indentation and blank lines inside the file', () => {
    const snippet = 'const item = localStorage.getItem(key)\nreturn item ? JSON.parse(item) : defaultValue';
    expect(locateSnippet(FILE, snippet)).toEqual({ start: 5, end: 7 });
  });

  it('accepts a one-line fragment of a line', () => {
    expect(locateSnippet(FILE, "from './axiosConfig'")).toEqual({ start: 1, end: 1 });
  });

  it('rejects invented, edited or empty snippets', () => {
    expect(locateSnippet(FILE, 'localStorage.setItem(key, value)')).toBeNull();
    expect(locateSnippet(FILE, '  try {\n    const item = sessionStorage.getItem(key)')).toBeNull();
    expect(locateSnippet(FILE, '   \n  ')).toBeNull();
    expect(locateSnippet(FILE, 'try')).toBeNull(); // too short to be a fragment
  });
});

describe('dedupeAgainstAccepted', () => {
  const accepted = [
    { rule: 'Use the shared axios instance.', evidencePath: 'a.js', evidenceSnippet: 'x()' },
  ];
  const c = (rule: string, evidencePath = 'b.js', evidenceSnippet = 'y()') => ({
    rule,
    evidencePath,
    evidenceSnippet,
    confidence: 0.5,
  });

  it('drops candidates repeating an accepted rule or its evidence, and in-batch repeats', () => {
    const out = dedupeAgainstAccepted(
      [
        c('use the shared  axios instance'),
        c('Other rule', 'a.js', '  x()  '),
        c('New rule'),
        c('New rule.', 'c.js', 'z()'),
        c('Second rule', 'c.js', 'w()'),
      ],
      accepted,
    );
    expect(out.map((o) => o.rule)).toEqual(['New rule', 'Second rule']);
  });
});

describe('small helpers', () => {
  it('ruleKey normalizes case, spacing and trailing punctuation', () => {
    expect(ruleKey('  Use   Foo. ')).toBe(ruleKey('use foo'));
  });
  it('normalizeConfidence clamps and accepts percentages', () => {
    expect(normalizeConfidence(0.4)).toBe(0.4);
    expect(normalizeConfidence(85)).toBe(0.85);
    expect(normalizeConfidence(-1)).toBe(0);
    expect(normalizeConfidence(Number.NaN)).toBe(0);
  });
  it('configCandidatePaths probes the root and each sampled top-level dir', () => {
    const paths = configCandidatePaths(['client/src/a.js', 'server/x.ts', 'index.js']);
    expect(paths).toContain('tsconfig.json');
    expect(paths).toContain('client/tsconfig.json');
    expect(paths).toContain('server/.eslintrc.json');
    expect(paths.some((p) => p.startsWith('index.js'))).toBe(false);
  });
});
