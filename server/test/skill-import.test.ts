import { describe, it, expect } from 'vitest';
import { strToU8, zipSync, type Zippable } from 'fflate';
import {
  IMPORT_LIMITS,
  SkillImportError,
  parseSkillImport,
  slugify,
} from '../src/modules/skills/import-parser.js';

const md = (s: string) => strToU8(s);
const zip = (files: Zippable) => zipSync(files);

const SKILL_MD = `---
name: flaky-test-patterns
description: Flag sleeps, real time and order-dependent tests.
type: rubric
---

# Flaky tests

- No sleeps.
`;

function expectImportError(fn: () => unknown, kind: SkillImportError['kind'], msg?: RegExp) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(SkillImportError);
    expect((err as SkillImportError).kind).toBe(kind);
    if (msg) expect((err as Error).message).toMatch(msg);
    return;
  }
  throw new Error('expected a SkillImportError');
}

describe('parseSkillImport — .md', () => {
  it('reads YAML frontmatter name/description/type and the body', () => {
    const p = parseSkillImport('skill.md', md(SKILL_MD));
    expect(p).toEqual({
      name: 'flaky-test-patterns',
      description: 'Flag sleeps, real time and order-dependent tests.',
      type: 'rubric',
      body: '# Flaky tests\n\n- No sleeps.',
      ignored_files: [],
      warnings: [],
    });
  });

  it('defaults type to custom; warns on an unknown type', () => {
    const noType = parseSkillImport('a.md', md('---\nname: a\ndescription: d\n---\nbody'));
    expect(noType.type).toBe('custom');
    expect(noType.warnings).toEqual([]);

    const bad = parseSkillImport('a.md', md('---\nname: a\ntype: magic\n---\nbody'));
    expect(bad.type).toBe('custom');
    expect(bad.warnings.join()).toMatch(/Unknown type "magic"/);
  });

  it('without frontmatter: name = slugified first heading, empty description, a warning', () => {
    const p = parseSkillImport('x.md', md('Intro\r\n# Corner Case Checklist!\r\nCheck nulls.'));
    expect(p.name).toBe('corner-case-checklist');
    expect(p.description).toBe('');
    expect(p.type).toBe('custom');
    expect(p.body).toBe('Intro\n# Corner Case Checklist!\nCheck nulls.');
    expect(p.warnings).toHaveLength(1);
  });

  it('rejects invalid YAML and non-UTF-8 bytes as invalid', () => {
    expectImportError(() => parseSkillImport('a.md', md('---\nname: [oops\n---\nbody')), 'invalid', /YAML/);
    expectImportError(() => parseSkillImport('a.md', new Uint8Array([0xff, 0xfe, 0x00])), 'invalid', /UTF-8/);
  });

  it('rejects a markdown file over 64 KB', () => {
    const big = md('# x\n' + 'a'.repeat(IMPORT_LIMITS.maxSkillMdBytes));
    expectImportError(() => parseSkillImport('a.md', big), 'invalid', /64 KB/);
  });
});

describe('parseSkillImport — .zip', () => {
  it('takes root SKILL.md and lists every other file as ignored (never extracted)', () => {
    const p = parseSkillImport(
      'flaky.zip',
      zip({
        'SKILL.md': md(SKILL_MD),
        scripts: { 'run.sh': md('#!/bin/sh\nrm -rf /\n') },
        'references/notes.md': md('ref'),
        'bin.dat': new Uint8Array([0, 1, 2, 3]),
      }),
    );
    expect(p.name).toBe('flaky-test-patterns');
    expect(p.type).toBe('rubric');
    expect(p.ignored_files.sort()).toEqual(['bin.dat', 'references/notes.md', 'scripts/run.sh']);
  });

  it('finds SKILL.md one level deep', () => {
    const p = parseSkillImport('s.zip', zip({ 'my-skill/SKILL.md': md(SKILL_MD), 'my-skill/x.txt': md('x') }));
    expect(p.name).toBe('flaky-test-patterns');
    expect(p.ignored_files).toEqual(['my-skill/x.txt']);
  });

  it('prefers the root SKILL.md over a nested one and warns', () => {
    const p = parseSkillImport(
      's.zip',
      zip({ 'a/SKILL.md': md('---\nname: nested\n---\nb'), 'SKILL.md': md('---\nname: root\n---\nb') }),
    );
    expect(p.name).toBe('root');
    expect(p.ignored_files).toEqual(['a/SKILL.md']);
    expect(p.warnings.join()).toMatch(/Several SKILL\.md/);
  });

  it('422-kind when there is no SKILL.md (two levels deep does not count)', () => {
    expectImportError(
      () => parseSkillImport('s.zip', zip({ 'a/b/SKILL.md': md(SKILL_MD), 'README.md': md('r') })),
      'invalid',
      /no SKILL\.md/,
    );
  });

  it('rejects `..` and absolute entry paths', () => {
    expectImportError(
      () => parseSkillImport('s.zip', zip({ 'SKILL.md': md(SKILL_MD), '../evil.sh': md('x') })),
      'invalid',
      /unsafe path/,
    );
    expectImportError(
      () => parseSkillImport('s.zip', zip({ 'SKILL.md': md(SKILL_MD), '/etc/passwd': md('x') })),
      'invalid',
      /unsafe path/,
    );
  });

  it('enforces the entry-count, total-uncompressed and SKILL.md size limits', () => {
    const many: Zippable = { 'SKILL.md': md(SKILL_MD) };
    for (let i = 0; i < IMPORT_LIMITS.maxZipEntries; i++) many[`f${i}.txt`] = md('x');
    expectImportError(() => parseSkillImport('s.zip', zip(many)), 'invalid', /entries/);

    // Highly compressible: tiny upload, > 5 MB declared uncompressed.
    const bomb = zip({ 'SKILL.md': md(SKILL_MD), 'big.txt': new Uint8Array(6 * 1_048_576) });
    expect(bomb.length).toBeLessThan(IMPORT_LIMITS.maxUploadBytes);
    expectImportError(() => parseSkillImport('s.zip', bomb), 'invalid', /5 MB/);

    const bigSkill = zip({ 'SKILL.md': md('# x\n' + 'a'.repeat(IMPORT_LIMITS.maxSkillMdBytes)) });
    expectImportError(() => parseSkillImport('s.zip', bigSkill), 'invalid', /64 KB/);
  });

  it('rejects bytes that are not a zip archive', () => {
    expectImportError(() => parseSkillImport('s.zip', md('not a zip')), 'invalid', /zip/);
  });
});

describe('parseSkillImport — other files', () => {
  it('rejects other extensions as unsupported_type', () => {
    expectImportError(() => parseSkillImport('skill.txt', md('x')), 'unsupported_type');
    expectImportError(() => parseSkillImport('skill.tar.gz', md('x')), 'unsupported_type');
  });

  it('rejects uploads over 1 MB', () => {
    expectImportError(
      () => parseSkillImport('s.zip', new Uint8Array(IMPORT_LIMITS.maxUploadBytes + 1)),
      'invalid',
      /1 MB/,
    );
  });
});

describe('slugify', () => {
  it('lowercases, strips diacritics and collapses separators', () => {
    expect(slugify('  Ünïcode — Edge Cases!! ')).toBe('unicode-edge-cases');
    expect(slugify('***')).toBe('');
  });
});
