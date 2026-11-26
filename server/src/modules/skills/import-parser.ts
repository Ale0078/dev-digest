import { unzipSync } from 'fflate';
import { parse as parseYaml } from 'yaml';
import { SkillType, type SkillImportPreview } from '@devdigest/shared';

/**
 * Pure skill-import parser (domain ring): bytes in → `SkillImportPreview` out.
 * No I/O: archives are read in memory, nothing is written to disk, nothing is
 * executed. Only the skill text (`SKILL.md`) is ever decompressed; every other
 * archive entry is listed in `ignored_files` by name only.
 */

export const IMPORT_LIMITS = {
  /** Max upload size (the route enforces it too, via multipart limits). */
  maxUploadBytes: 1_048_576,
  maxZipEntries: 200,
  /** Sum of the declared uncompressed sizes of every zip entry. */
  maxTotalUncompressedBytes: 5 * 1_048_576,
  maxSkillMdBytes: 64 * 1024,
} as const;

export type SkillImportErrorKind = 'unsupported_type' | 'invalid';

/** Thrown by the parser; the service maps `kind` onto an HTTP-level AppError. */
export class SkillImportError extends Error {
  constructor(
    public readonly kind: SkillImportErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SkillImportError';
  }
}

const invalid = (message: string) => new SkillImportError('invalid', message);

/** Lowercase, ascii, dash-separated; '' when nothing usable is left. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}

function decodeUtf8(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw invalid(`${label} is not valid UTF-8 text`);
  }
}

const FRONTMATTER = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;

/** Parse markdown text (optionally with YAML frontmatter) into a preview. */
export function parseSkillMarkdown(text: string, filename: string): SkillImportPreview {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const warnings: string[] = [];
  const fm = FRONTMATTER.exec(src);

  let meta: Record<string, unknown> = {};
  let body = src;
  if (fm) {
    let parsed: unknown;
    try {
      // yaml v2 `parse` is data-only (no custom/JS tags), safe for untrusted input.
      parsed = parseYaml(fm[1]!);
    } catch {
      throw invalid('Invalid YAML frontmatter');
    }
    if (parsed !== null && parsed !== undefined) {
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw invalid('YAML frontmatter must be a mapping');
      }
      meta = parsed as Record<string, unknown>;
    }
    body = src.slice(fm[0].length);
  }
  body = body.trim();

  const str = (v: unknown): string | undefined =>
    typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : undefined;

  let name = str(meta.name) ?? '';
  const description = str(meta.description) ?? '';

  if (!name) {
    const heading = /^#[ \t]+(.+?)[ \t#]*$/m.exec(body);
    name = heading ? slugify(heading[1]!) : '';
    if (!name) name = slugify(filename.replace(/\.[^.]*$/, '').split('/').pop() ?? '');
    warnings.push(
      fm
        ? 'Frontmatter has no `name`; the name was derived from the first heading.'
        : 'No YAML frontmatter: the name was derived from the first heading and the description is empty.',
    );
  }

  let type: SkillType = 'custom';
  if (meta.type !== undefined) {
    const t = SkillType.safeParse(meta.type);
    if (t.success) type = t.data;
    else warnings.push(`Unknown type "${String(meta.type)}"; using "custom".`);
  }

  if (!body) warnings.push('The skill body is empty.');

  return { name, description, type, body, ignored_files: [], warnings };
}

/** Normalise a zip entry path; throws on absolute paths or `..` segments. */
function safeEntryPath(raw: string): string {
  const p = raw.replace(/\\/g, '/');
  if (p.startsWith('/') || /^[a-zA-Z]:/.test(p) || p.split('/').includes('..')) {
    throw invalid(`Archive entry has an unsafe path: ${raw}`);
  }
  return p;
}

interface ZipEntryMeta {
  raw: string;
  path: string;
  originalSize: number;
  isDir: boolean;
}

function isSkillMdCandidate(path: string): boolean {
  const parts = path.split('/');
  return parts.length <= 2 && parts[parts.length - 1]!.toLowerCase() === 'skill.md';
}

function parseZip(bytes: Uint8Array, filename: string): SkillImportPreview {
  // Pass 1: read the central directory only (filter returns false → nothing inflated).
  const entries: ZipEntryMeta[] = [];
  let total = 0;
  try {
    unzipSync(bytes, {
      filter: (f) => {
        entries.push({
          raw: f.name,
          path: safeEntryPath(f.name),
          originalSize: f.originalSize,
          isDir: f.name.endsWith('/'),
        });
        if (entries.length > IMPORT_LIMITS.maxZipEntries) {
          throw invalid(`Archive has more than ${IMPORT_LIMITS.maxZipEntries} entries`);
        }
        total += f.originalSize;
        if (total > IMPORT_LIMITS.maxTotalUncompressedBytes) {
          throw invalid('Archive is larger than 5 MB uncompressed');
        }
        return false;
      },
    });
  } catch (err) {
    if (err instanceof SkillImportError) throw err;
    throw invalid('Not a readable zip archive');
  }

  const candidates = entries
    .filter((e) => !e.isDir && isSkillMdCandidate(e.path))
    // Root first, then alphabetical, so the pick is deterministic.
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));
  const chosen = candidates[0];
  if (!chosen) throw invalid('Archive has no SKILL.md at its root or one level deep');
  if (chosen.originalSize > IMPORT_LIMITS.maxSkillMdBytes) {
    throw invalid('SKILL.md is larger than 64 KB');
  }

  // Pass 2: inflate SKILL.md only. fflate sizes the output buffer from the
  // declared size checked above, so a lying header cannot expand past it.
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === chosen.raw });
  } catch {
    throw invalid('SKILL.md could not be decompressed');
  }
  const data = files[chosen.raw];
  if (!data) throw invalid('SKILL.md could not be decompressed');
  if (data.length > IMPORT_LIMITS.maxSkillMdBytes) throw invalid('SKILL.md is larger than 64 KB');

  const preview = parseSkillMarkdown(decodeUtf8(data, 'SKILL.md'), chosen.path);
  if (!preview.name) preview.name = slugify(filename.replace(/\.zip$/i, ''));
  preview.ignored_files = entries.filter((e) => !e.isDir && e !== chosen).map((e) => e.path);
  if (candidates.length > 1) {
    preview.warnings.push(`Several SKILL.md files found; using ${chosen.path}.`);
  }
  return preview;
}

/**
 * Parse an uploaded skill file. `.md` → markdown; `.zip` → archive with a
 * `SKILL.md`. Any other extension → `SkillImportError('unsupported_type')`.
 */
export function parseSkillImport(filename: string, bytes: Uint8Array): SkillImportPreview {
  const lower = filename.toLowerCase();
  const kind = lower.endsWith('.md') ? 'md' : lower.endsWith('.zip') ? 'zip' : null;
  if (!kind) throw new SkillImportError('unsupported_type', 'Only .md and .zip files can be imported');
  if (bytes.length > IMPORT_LIMITS.maxUploadBytes) throw invalid('File is larger than 1 MB');

  if (kind === 'zip') return parseZip(bytes, filename);

  if (bytes.length > IMPORT_LIMITS.maxSkillMdBytes) throw invalid('Skill file is larger than 64 KB');
  const preview = parseSkillMarkdown(decodeUtf8(bytes, filename), filename);
  return preview;
}
