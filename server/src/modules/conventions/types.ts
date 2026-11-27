import type { LLMProvider, Skill } from '@devdigest/shared';
import type { CreateSkillInput } from '../skills/service.js';

/**
 * Ports for the conventions module. `ConventionsService` depends on these
 * interfaces only; `repository.ts` implements `ConventionsStore` with Drizzle and
 * `routes.ts` wires the rest from the `Container`.
 */

/** A stored convention candidate, mapped out of the DB row at the repository boundary. */
export interface ConventionRecord {
  id: string;
  rule: string;
  evidencePath: string;
  evidenceSnippet: string;
  confidence: number;
  accepted: boolean;
}

/** A grounded candidate about to be stored (always pending: `accepted=false`). */
export interface NewConvention {
  rule: string;
  evidencePath: string;
  evidenceSnippet: string;
  confidence: number;
}

/** The bits of a repo the extractor needs. */
export interface RepoRef {
  id: string;
  fullName: string;
  clonePath: string | null;
}

export interface ConventionPatch {
  rule?: string;
  accepted?: boolean;
}

export interface ConventionsStore {
  /** The repo if it belongs to the workspace (tenancy guard). */
  getRepo(workspaceId: string, repoId: string): Promise<RepoRef | undefined>;
  /** Candidates of a repo, highest confidence first. */
  list(workspaceId: string, repoId: string): Promise<ConventionRecord[]>;
  update(
    workspaceId: string,
    repoId: string,
    id: string,
    patch: ConventionPatch,
  ): Promise<ConventionRecord | undefined>;
  delete(workspaceId: string, repoId: string, id: string): Promise<boolean>;
  /** Atomically drop the repo's pending (not accepted) rows and insert `rows`. */
  replacePending(workspaceId: string, repoId: string, rows: NewConvention[]): Promise<void>;
}

/** The repo-intel facade slice the extractor uses (structurally `RepoIntel`). */
export interface ConventionSampler {
  getConventionSamples(repoId: string, n: number): Promise<string[]>;
}

/** Contained read of a repo-relative file from a clone; null when unreadable. */
export type CloneFileReader = (cloneRoot: string, rel: string) => Promise<string | null>;

/** The provider + model chosen for the `conventions` feature in Settings. */
export interface ConventionModel {
  llm: LLMProvider;
  model: string;
}
export type ConventionModelResolver = (workspaceId: string) => Promise<ConventionModel>;

/** The skills module's create use case (structurally `SkillsService`). */
export interface SkillCreator {
  create(workspaceId: string, input: CreateSkillInput): Promise<Skill>;
}
