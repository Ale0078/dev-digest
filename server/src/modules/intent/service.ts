import type {
  IntentSource,
  PrIntentRecord,
  PrIntentResponse,
} from '@devdigest/shared';
import {
  classifyIntent,
  summarizeDiffForIntent,
  type IntentSourceInput,
} from '@devdigest/reviewer-core';
import {
  AppError,
  ConfigError,
  ExternalServiceError,
  NotFoundError,
} from '../../platform/errors.js';
import {
  MAX_BODY_CHARS,
  MAX_DOCS,
  MAX_DOC_CHARS,
  MAX_EXTERNAL_LINKS,
  MAX_ISSUES,
  MAX_ISSUE_CHARS,
  MAX_SOURCES_CHARS,
  MAX_TICKETS,
} from './constants.js';
import {
  capConfidence,
  classifyLink,
  extractIssueRefs,
  extractRelativeDocs,
  extractTicketKeys,
  extractUrls,
  isStale,
  scopeFilterEnabled,
  mergeMissingContext,
  normalizeIntent,
  redactUrl,
  type IssueRef,
} from './helpers.js';
import type {
  IntentDeps,
  IntentLogger,
  IntentPull,
  IntentRunLog,
  ReviewIntent,
  StoredIntent,
} from './types.js';

/** One gathered source: what the classifier sees (`input`) and what the record stores (`source`). */
interface Gathered {
  input: IntentSourceInput;
  source: IntentSource;
}

const gathered = (
  kind: IntentSource['kind'],
  ref: string,
  status: IntentSource['status'],
  opts: { title?: string | null; reason?: string; text?: string } = {},
): Gathered => ({
  input: { kind, ref, title: opts.title ?? null, status, reason: opts.reason ?? null, text: opts.text },
  source: {
    kind,
    ref,
    title: opts.title ?? null,
    status,
    reason: opts.reason ?? null,
    chars: status === 'fetched' ? (opts.text?.length ?? 0) : 0,
  },
});

const issueRefText = (r: IssueRef) => `${r.owner}/${r.name}#${r.number}`;

/** Octokit errors carry a numeric `status`; the message is never surfaced (it can echo request data). */
function issueFailureReason(err: unknown): string {
  if (err instanceof ConfigError) return 'GitHub not configured';
  const status = (err as { status?: number } | undefined)?.status;
  if (status === 404 || status === 410) return 'not found or no access';
  if (status === 403) return 'access denied or rate limited';
  return 'fetch failed';
}

/**
 * Intent layer use cases. Sources are gathered by code (caps + availability labels), ONE cheap
 * model call classifies them, and the model's output is capped/normalized by code before storage.
 * Never part of a review run: `forReview` only reads.
 */
export class IntentService {
  constructor(private deps: IntentDeps) {}

  private async pull(workspaceId: string, prId: string): Promise<IntentPull> {
    const pull = await this.deps.store.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    return pull;
  }

  private toRecord(stored: StoredIntent, pull: IntentPull): PrIntentRecord {
    return {
      pr_id: stored.prId,
      summary: stored.summary,
      in_scope: stored.inScope,
      out_of_scope: stored.outOfScope,
      risk_areas: stored.riskAreas,
      confidence: stored.confidence,
      missing_context: stored.missingContext,
      sources: stored.sources,
      head_sha: stored.headSha,
      stale: isStale(stored.headSha, pull.headSha),
      provider: stored.provider,
      model: stored.model,
      tokens_in: stored.tokensIn,
      tokens_out: stored.tokensOut,
      cost_usd: stored.costUsd,
      updated_at: stored.updatedAt.toISOString(),
    };
  }

  async get(workspaceId: string, prId: string): Promise<PrIntentResponse> {
    const pull = await this.pull(workspaceId, prId);
    const stored = await this.deps.store.get(prId);
    return { intent: stored ? this.toRecord(stored, pull) : null };
  }

  /**
   * The stored intent for a review run. Read-only: never classifies, never throws — a failed
   * lookup is reported through `log` and the review simply runs without intent.
   */
  async forReview(
    workspaceId: string,
    prId: string,
    log?: IntentRunLog,
  ): Promise<ReviewIntent | undefined> {
    try {
      const pull = await this.deps.store.getPull(workspaceId, prId);
      if (!pull) return undefined;
      const stored = await this.deps.store.get(prId);
      if (!stored) return undefined;
      const record = this.toRecord(stored, pull);
      return { record, stale: record.stale, filter: scopeFilterEnabled(record.stale, record.confidence) };
    } catch (err) {
      log?.info(`intent: lookup failed — ${err instanceof Error ? err.message : 'unknown error'}`);
      return undefined;
    }
  }

  async detect(workspaceId: string, prId: string, log?: IntentLogger): Promise<PrIntentRecord> {
    const pull = await this.pull(workspaceId, prId);
    const { llm, model, provider } = await this.deps.resolveModel(workspaceId);

    const items = await this.gather(workspaceId, pull);
    const input = {
      title: pull.title,
      author: pull.author,
      sources: items.filter((g) => g.source.kind !== 'pr_title' && g.source.kind !== 'diff_headers').map((g) => g.input),
      diffSummary: items.find((g) => g.source.kind === 'diff_headers')?.input.text ?? '(diff unavailable)',
    };
    const sources = items.map((g) => g.source);

    let res;
    try {
      res = await classifyIntent({
        llm,
        model,
        input,
        sessionId: `${pull.repo.owner}/${pull.repo.name}#${pull.number}:intent`,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      throw new ExternalServiceError(`The intent model call failed: ${reason}`);
    }

    const norm = normalizeIntent(res.data);
    const stored = await this.deps.store.upsert(pull.id, {
      summary: norm.summary,
      inScope: norm.in_scope,
      outOfScope: norm.out_of_scope,
      riskAreas: norm.risk_areas,
      confidence: capConfidence(res.data.confidence, sources),
      missingContext: mergeMissingContext(res.data.missing_context, sources),
      sources,
      headSha: pull.headSha,
      provider,
      model,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      costUsd: res.costUsd,
    });

    // Metadata only: never the PR body, issue/doc text or diff.
    log?.info(
      {
        call: 'intent_classifier',
        prId,
        provider,
        model,
        estTokensIn: this.deps.tokenizer.count(res.messages.map((m) => m.content).join('\n')),
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
        costUsd: res.costUsd,
        sources: sources.map((s) => ({
          kind: s.kind,
          ref: s.kind === 'external_link' ? redactUrl(s.ref) : s.ref,
          status: s.status,
          chars: s.chars,
        })),
      },
      'intent: classified',
    );
    return this.toRecord(stored, pull);
  }

  // ---- source gathering ----------------------------------------------------

  private async gather(workspaceId: string, pull: IntentPull): Promise<Gathered[]> {
    const body = (pull.body ?? '').slice(0, MAX_BODY_CHARS);
    const text = `${pull.title}\n${body}`;
    const repo = { owner: pull.repo.owner, name: pull.repo.name };

    // Classify every link in the body once.
    const issueRefs: IssueRef[] = extractIssueRefs(text, repo);
    const docPaths: string[] = [...extractRelativeDocs(body)];
    const externals: string[] = [];
    const ticketLinks: string[] = [];
    for (const url of extractUrls(body)) {
      const c = classifyLink(url, repo);
      if (c.kind === 'issue') {
        if (!issueRefs.some((r) => issueRefText(r).toLowerCase() === issueRefText(c.ref).toLowerCase())) {
          issueRefs.push(c.ref);
        }
      } else if (c.kind === 'repo_doc') {
        if (!docPaths.includes(c.path)) docPaths.push(c.path);
      } else if (c.kind === 'ticket') ticketLinks.push(url);
      else if (c.kind === 'external') externals.push(url);
    }

    const head: Gathered[] = [
      gathered('pr_title', `#${pull.number}`, 'fetched', { title: pull.title, text: pull.title }),
      body.trim()
        ? gathered('pr_description', `#${pull.number}`, 'fetched', { text: body })
        : gathered('pr_description', `#${pull.number}`, 'skipped', { reason: 'PR has no description' }),
      await this.diffHeaders(workspaceId, pull),
    ];

    const [issues, docs, links] = await Promise.all([
      this.gatherIssues(pull, repo, issueRefs),
      this.gatherDocs(pull, docPaths.slice(0, MAX_DOCS)),
      this.gatherExternal(externals.slice(0, MAX_EXTERNAL_LINKS)),
    ]);

    // Jira/Linear are never fetched (credentials required); the key/URL stays as a text signal.
    const tickets: Gathered[] = [
      ...extractTicketKeys(text),
      ...ticketLinks.map(redactUrl),
    ]
      .slice(0, MAX_TICKETS)
      .map((ref) => gathered('ticket', ref, 'unavailable', { reason: 'credentials required' }));

    return [...head, ...this.applyBudget([...issues, ...docs, ...links]), ...tickets];
  }

  private async diffHeaders(workspaceId: string, pull: IntentPull): Promise<Gathered> {
    try {
      const diff = await this.deps.loadDiff(workspaceId, pull.id);
      return gathered('diff_headers', `${diff.files.length} file(s)`, 'fetched', {
        text: summarizeDiffForIntent(diff),
      });
    } catch {
      return gathered('diff_headers', 'diff', 'unavailable', { reason: 'diff could not be loaded' });
    }
  }

  private async gatherIssues(
    pull: IntentPull,
    repo: { owner: string; name: string },
    fromText: IssueRef[],
  ): Promise<Gathered[]> {
    let github;
    try {
      github = await this.deps.github();
    } catch (err) {
      if (!(err instanceof ConfigError)) throw err;
      return fromText
        .slice(0, MAX_ISSUES)
        .map((r) => gathered('linked_issue', issueRefText(r), 'unavailable', { reason: 'GitHub not configured' }));
    }
    // GitHub's own closing references first; a failure here is ignored (regex refs still work).
    const closing = await github.listClosingIssues(repo, pull.number).catch(() => []);
    const refs: IssueRef[] = [];
    for (const r of [...closing, ...fromText]) {
      if (!refs.some((x) => issueRefText(x).toLowerCase() === issueRefText(r).toLowerCase())) refs.push(r);
    }
    return Promise.all(
      refs.slice(0, MAX_ISSUES).map(async (r) => {
        const ref = issueRefText(r);
        try {
          const issue = await github.getIssue({ owner: r.owner, name: r.name }, r.number);
          const text = `${issue.title}\n\n${issue.body ?? ''}`.slice(0, MAX_ISSUE_CHARS);
          return gathered('linked_issue', ref, 'fetched', { title: issue.title.slice(0, 200), text });
        } catch (err) {
          return gathered('linked_issue', ref, 'unavailable', { reason: issueFailureReason(err) });
        }
      }),
    );
  }

  private async gatherDocs(pull: IntentPull, paths: string[]): Promise<Gathered[]> {
    return Promise.all(
      paths.map(async (path) => {
        if (!pull.repo.clonePath) {
          return gathered('repo_doc', path, 'unavailable', { reason: 'repository is not cloned' });
        }
        const text = await this.deps.readFile(pull.repo.clonePath, path);
        if (text === null || text.trim() === '') {
          return gathered('repo_doc', path, 'unavailable', { reason: 'file not found or not readable' });
        }
        return gathered('repo_doc', path, 'fetched', { text: text.slice(0, MAX_DOC_CHARS) });
      }),
    );
  }

  private async gatherExternal(urls: string[]): Promise<Gathered[]> {
    return Promise.all(
      urls.map(async (url) => {
        const ref = redactUrl(url);
        if (!this.deps.linkFetchEnabled) {
          return gathered('external_link', ref, 'skipped', { reason: 'external link fetching is disabled' });
        }
        const res = await this.deps.linkFetcher.fetch(url);
        if (res.status === 'unavailable') {
          return gathered('external_link', ref, 'unavailable', { reason: res.reason });
        }
        return gathered('external_link', ref, 'fetched', { title: res.title, text: res.text });
      }),
    );
  }

  /** Total chars across issue → spec → external sources are capped, in that priority order. */
  private applyBudget(items: Gathered[]): Gathered[] {
    const rank = { linked_issue: 0, repo_doc: 1, external_link: 2 } as const;
    const order = [...items].sort(
      (a, b) =>
        (rank[a.source.kind as keyof typeof rank] ?? 3) - (rank[b.source.kind as keyof typeof rank] ?? 3),
    );
    let remaining = MAX_SOURCES_CHARS;
    const replaced = new Map<Gathered, Gathered>();
    for (const g of order) {
      if (g.source.status !== 'fetched') continue;
      const text = g.input.text ?? '';
      if (remaining <= 0) {
        replaced.set(
          g,
          gathered(g.source.kind, g.source.ref, 'skipped', { title: g.source.title, reason: 'source budget exhausted' }),
        );
        continue;
      }
      if (text.length > remaining) {
        replaced.set(
          g,
          gathered(g.source.kind, g.source.ref, 'fetched', { title: g.source.title, text: text.slice(0, remaining) }),
        );
      }
      remaining -= Math.min(text.length, remaining);
    }
    return items.map((g) => replaced.get(g) ?? g);
  }
}
