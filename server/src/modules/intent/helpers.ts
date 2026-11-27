import type { IntentClassification, IntentConfidence, IntentSource } from '@devdigest/shared';
import {
  MAX_ITEM_CHARS,
  MAX_MISSING_CONTEXT,
  MAX_RISK_CHARS,
  MAX_SUMMARY_CHARS,
  TICKET_FALSE_PREFIXES,
} from './constants.js';

/** Pure helpers of the intent module (no I/O) — reference extraction, caps, normalization. */

export interface RepoName {
  owner: string;
  name: string;
}
export interface IssueRef extends RepoName {
  number: number;
}

const sameRepo = (a: RepoName, b: RepoName) =>
  a.owner.toLowerCase() === b.owner.toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase();

const issueKey = (r: IssueRef) => `${r.owner}/${r.name}#${r.number}`.toLowerCase();

/** Issue references in free text, in order of appearance, deduped: `#N`, `o/r#N`, `…/issues/N` URLs. */
export function extractIssueRefs(text: string, repo: RepoName): IssueRef[] {
  const found: { index: number; ref: IssueRef }[] = [];
  for (const m of text.matchAll(/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d{1,7})\b/gi)) {
    found.push({ index: m.index ?? 0, ref: { owner: m[1]!, name: m[2]!, number: Number(m[3]) } });
  }
  for (const m of text.matchAll(/(?<![\w/.-])([\w.-]+)\/([\w.-]+)#(\d{1,7})\b/g)) {
    found.push({ index: m.index ?? 0, ref: { owner: m[1]!, name: m[2]!, number: Number(m[3]) } });
  }
  for (const m of text.matchAll(/(?<![\w&/#])#(\d{1,7})\b/g)) {
    found.push({ index: m.index ?? 0, ref: { ...repo, number: Number(m[1]) } });
  }
  found.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const out: IssueRef[] = [];
  for (const { ref } of found) {
    const k = issueKey(ref);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(ref);
  }
  return out;
}

/** http(s) URLs in free text, deduped, trailing punctuation stripped. */
export function extractUrls(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/https?:\/\/[^\s<>"'`)\]]+/gi)) {
    const url = m[0].replace(/[.,;:!?]+$/, '');
    if (!out.includes(url)) out.push(url);
  }
  return out;
}

/** Relative markdown links to `*.md` files (`[spec](docs/spec.md#x)`), normalized to repo-relative paths. */
export function extractRelativeDocs(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+?\.md)(?:#[^)\s]*)?\)/gi)) {
    const path = m[1]!.replace(/^\.\//, '').replace(/^\/+/, '');
    if (path && !out.includes(path)) out.push(path);
  }
  return out;
}

/** Jira-style keys (`ABC-123`), minus well-known look-alikes (`UTF-8`, `SHA-256`). */
export function extractTicketKeys(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?<![\w-])([A-Z][A-Z0-9]+)-(\d+)\b/g)) {
    if (TICKET_FALSE_PREFIXES.has(m[1]!)) continue;
    const key = `${m[1]}-${m[2]}`;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

export type LinkClass =
  | { kind: 'repo_doc'; path: string }
  | { kind: 'issue'; ref: IssueRef }
  | { kind: 'ticket' }
  | { kind: 'external' }
  | { kind: 'skip' };

/** Decide how a URL found in the PR body is handled. */
export function classifyLink(rawUrl: string, repo: RepoName): LinkClass {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { kind: 'skip' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { kind: 'skip' };
  const host = u.hostname.toLowerCase();
  if (host === 'atlassian.net' || host.endsWith('.atlassian.net')) return { kind: 'ticket' };
  if (host === 'linear.app' || host.endsWith('.linear.app')) return { kind: 'ticket' };
  if (host === 'github.com' || host === 'www.github.com') {
    const seg = u.pathname.split('/').filter(Boolean);
    const target = { owner: seg[0] ?? '', name: seg[1] ?? '' };
    if (seg[2] === 'issues' && /^\d+$/.test(seg[3] ?? '')) {
      return { kind: 'issue', ref: { ...target, number: Number(seg[3]) } };
    }
    if (seg[2] === 'blob' && seg.length >= 5 && sameRepo(target, repo)) {
      // seg[3] is the ref (branch/sha); a branch name containing "/" is not supported.
      return { kind: 'repo_doc', path: decodeURIComponent(seg.slice(4).join('/')) };
    }
  }
  return { kind: 'external' };
}

/** A URL safe to store / log: no userinfo, query or fragment. Unparseable input → a fixed placeholder. */
export function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return '[invalid url]';
  }
}

/** Classifier input signals that count as a real description of intent. */
const CONTENT_KINDS = new Set<IntentSource['kind']>([
  'pr_description',
  'linked_issue',
  'repo_doc',
  'external_link',
]);

/**
 * Cap the model's self-reported confidence by what it could actually see:
 * no description and nothing fetched → `low`; any unavailable source → at most `medium`.
 */
export function capConfidence(
  reported: IntentConfidence,
  sources: Pick<IntentSource, 'kind' | 'status'>[],
): IntentConfidence {
  const hasContent = sources.some((s) => CONTENT_KINDS.has(s.kind) && s.status === 'fetched');
  if (!hasContent) return 'low';
  const anyUnavailable = sources.some((s) => s.status === 'unavailable');
  if (anyUnavailable && reported === 'high') return 'medium';
  return reported;
}

/** Missing-context list: one entry per unavailable source first (code-derived), then the model's, ≤ 6. */
export function mergeMissingContext(modelItems: string[], sources: IntentSource[]): string[] {
  const fromSources = sources
    .filter((s) => s.status === 'unavailable')
    .map((s) => `${s.ref} — ${s.reason ?? 'unavailable'}`.slice(0, MAX_ITEM_CHARS));
  const out: string[] = [];
  for (const item of [...fromSources, ...modelItems.map((m) => m.trim()).filter(Boolean)]) {
    const clipped = item.slice(0, MAX_ITEM_CHARS);
    if (!out.includes(clipped)) out.push(clipped);
  }
  return out.slice(0, MAX_MISSING_CONTEXT);
}

const clip = (items: string[], max: number, count: number) =>
  items
    .map((i) => i.replace(/\s+/g, ' ').trim().slice(0, max))
    .filter(Boolean)
    .slice(0, count);

/** Truncate the model's strings/arrays in code — its output is untrusted and must stay small. */
export function normalizeIntent(
  d: IntentClassification,
): Pick<IntentClassification, 'summary' | 'in_scope' | 'out_of_scope' | 'risk_areas'> {
  return {
    summary: d.summary.replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY_CHARS),
    in_scope: clip(d.in_scope, MAX_ITEM_CHARS, 8),
    out_of_scope: clip(d.out_of_scope, MAX_ITEM_CHARS, 8),
    risk_areas: clip(d.risk_areas, MAX_RISK_CHARS, 6),
  };
}

/** Intent is stale when the PR head moved after classification (or the sha was never recorded). */
export function isStale(storedHeadSha: string | null, pullHeadSha: string): boolean {
  return storedHeadSha !== pullHeadSha;
}

/** The scope filter may drop findings only for a fresh intent the classifier is reasonably sure of. */
export function scopeFilterEnabled(stale: boolean, confidence: IntentConfidence): boolean {
  return !stale && confidence !== 'low';
}
