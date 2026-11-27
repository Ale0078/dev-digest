import type { IntentSource, LLMProvider, PrIntentRecord, UnifiedDiff } from '@devdigest/shared';

/**
 * Ports for the intent module. `IntentService` depends on these interfaces
 * only; `repository.ts` implements `IntentStore` with Drizzle and `routes.ts`
 * wires the rest from the `Container`.
 */

/** Result of a safe external link fetch. `fetch` never throws. */
export type FetchedLink =
  | { status: 'fetched'; text: string; title: string | null }
  | { status: 'unavailable'; reason: string };

/** Port: fetch an external http(s) URL as plain text under SSRF/size/time guards. */
export interface LinkFetcher {
  fetch(url: string): Promise<FetchedLink>;
}

/** The PR (and its repo) an intent is computed for, mapped at the repository boundary. */
export interface IntentPull {
  id: string;
  number: number;
  title: string;
  author: string;
  body: string | null;
  headSha: string;
  repo: { id: string; owner: string; name: string; clonePath: string | null };
}

/** A stored intent row, mapped out of the DB row. */
export interface StoredIntent {
  prId: string;
  summary: string;
  inScope: string[];
  outOfScope: string[];
  riskAreas: string[];
  confidence: 'high' | 'medium' | 'low';
  missingContext: string[];
  sources: IntentSource[];
  headSha: string | null;
  provider: string | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  updatedAt: Date;
}

export type NewIntent = Omit<StoredIntent, 'prId' | 'updatedAt'>;

export interface IntentStore {
  /** The PR (with repo) if it belongs to the workspace (tenancy guard). */
  getPull(workspaceId: string, prId: string): Promise<IntentPull | undefined>;
  get(prId: string): Promise<StoredIntent | undefined>;
  upsert(prId: string, intent: NewIntent): Promise<StoredIntent>;
}

/** GitHub slice the gatherer uses (structurally `GitHubClient`). */
export interface IntentGitHub {
  getIssue(
    repo: { owner: string; name: string },
    n: number,
  ): Promise<{ number: number; title: string; body?: string | null; state: string }>;
  listClosingIssues(
    repo: { owner: string; name: string },
    n: number,
  ): Promise<{ owner: string; name: string; number: number }[]>;
}

/** Loads the PR's unified diff (the reviews module's `loadDiff`, bound in the composition root). */
export type IntentDiffLoader = (workspaceId: string, prId: string) => Promise<UnifiedDiff>;

/** Contained read of a repo-relative file from a clone; null when unreadable. */
export type CloneFileReader = (cloneRoot: string, rel: string) => Promise<string | null>;

/** The provider + model chosen for the `review_intent` feature in Settings. */
export interface IntentModel {
  provider: string;
  llm: LLMProvider;
  model: string;
}
export type IntentModelResolver = (workspaceId: string) => Promise<IntentModel>;

/** Resolves the GitHub client lazily; rejects with `ConfigError` when no token is configured. */
export type GitHubResolver = () => Promise<IntentGitHub>;

/** Minimal pino-compatible logger. */
export interface IntentLogger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}

/** Where `forReview` reports what it found (structurally the executor's `RunLogger`). */
export interface IntentRunLog {
  info: (msg: string) => void;
}

/** What the executor gets back from `forReview`. */
export interface ReviewIntent {
  record: PrIntentRecord;
  stale: boolean;
  /** Whether the scope filter may drop findings (fresh intent, confidence above `low`). */
  filter: boolean;
}

/** Everything `IntentService` needs, as ports (wired in `platform/container.ts`). */
export interface IntentDeps {
  store: IntentStore;
  loadDiff: IntentDiffLoader;
  github: GitHubResolver;
  readFile: CloneFileReader;
  linkFetcher: LinkFetcher;
  /** `INTENT_LINK_FETCH` kill switch; false → external links are `skipped`. */
  linkFetchEnabled: boolean;
  resolveModel: IntentModelResolver;
  tokenizer: { count(text: string): number };
}
