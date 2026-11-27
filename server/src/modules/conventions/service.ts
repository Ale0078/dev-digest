import { z } from 'zod';
import type { ConventionCandidate, ConventionExtractResult, Skill } from '@devdigest/shared';
import {
  AppError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from '../../platform/errors.js';
import {
  MAX_CANDIDATES,
  MAX_CONFIG_FILES,
  SAMPLE_COUNT,
  SYSTEM_PROMPT,
  buildUserPrompt,
  configCandidatePaths,
  dedupeAgainstAccepted,
  locateSnippet,
  normalizeConfidence,
  toConventionDto,
} from './helpers.js';
import type {
  CloneFileReader,
  ConventionModelResolver,
  ConventionPatch,
  ConventionRecord,
  ConventionSampler,
  ConventionsStore,
  NewConvention,
  RepoRef,
  SkillCreator,
} from './types.js';

/** What the model returns: one structured call per extraction run. */
export const ConventionExtraction = z.object({
  conventions: z.array(
    z.object({
      rule: z.string(),
      evidence_path: z.string(),
      evidence_snippet: z.string(),
      confidence: z.number(),
    }),
  ),
});
export type ConventionExtraction = z.infer<typeof ConventionExtraction>;

export interface CreateConventionSkillInput {
  name: string;
  description: string;
  body: string;
  enabled: boolean;
  conventionIds: string[];
}

/**
 * Conventions Extractor use cases. Files are picked by code (ranked samples +
 * config files), the model is called ONCE per run, and every candidate's
 * evidence is checked by code before it is stored.
 */
export class ConventionsService {
  constructor(
    private store: ConventionsStore,
    private sampler: ConventionSampler,
    private readFile: CloneFileReader,
    private resolveModel: ConventionModelResolver,
    private skills: SkillCreator,
  ) {}

  private async repo(workspaceId: string, repoId: string): Promise<RepoRef> {
    const repo = await this.store.getRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    return repo;
  }

  /** Records → DTOs, locating each snippet's line range in the current checkout. */
  private async toDtos(repo: RepoRef, records: ConventionRecord[]): Promise<ConventionCandidate[]> {
    const files = new Map<string, Promise<string | null>>();
    const read = (path: string) => {
      if (!repo.clonePath) return Promise.resolve(null);
      let p = files.get(path);
      if (!p) {
        p = this.readFile(repo.clonePath, path);
        files.set(path, p);
      }
      return p;
    };
    return Promise.all(
      records.map(async (r) => {
        const text = await read(r.evidencePath);
        return toConventionDto(r, text === null ? null : locateSnippet(text, r.evidenceSnippet));
      }),
    );
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionCandidate[]> {
    const repo = await this.repo(workspaceId, repoId);
    return this.toDtos(repo, await this.store.list(workspaceId, repoId));
  }

  async extract(workspaceId: string, repoId: string): Promise<ConventionExtractResult> {
    const repo = await this.repo(workspaceId, repoId);
    const clone = repo.clonePath;
    if (!clone) {
      throw new ValidationError('The repo is not cloned yet — sync it before extracting conventions');
    }

    // 1. Sampling by code: ranked sources + config files (no model involved).
    const samplePaths = await this.sampler.getConventionSamples(repoId, SAMPLE_COUNT);
    const sources = await this.readAll(clone, samplePaths);
    if (sources.length === 0) {
      throw new ValidationError(
        'No indexed source files to sample — index the repo before extracting conventions',
      );
    }
    const configs = (await this.readAll(clone, configCandidatePaths(samplePaths))).slice(
      0,
      MAX_CONFIG_FILES,
    );

    // 2. One structured model call.
    const { llm, model } = await this.resolveModel(workspaceId);
    let data: ConventionExtraction;
    try {
      const res = await llm.completeStructured({
        model,
        schema: ConventionExtraction,
        schemaName: 'ConventionExtraction',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(repo.fullName, configs, sources) },
        ],
        temperature: 0,
      });
      data = res.data;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      throw new ExternalServiceError(`The conventions model call failed: ${reason}`);
    }

    // 3. Grounding by code: the cited file was sent AND contains the snippet.
    const byPath = new Map([...configs, ...sources].map((f) => [f.path, f.text]));
    const grounded: NewConvention[] = [];
    for (const c of data.conventions) {
      const rule = c.rule.trim();
      const text = byPath.get(c.evidence_path.trim());
      if (!rule || text === undefined || !locateSnippet(text, c.evidence_snippet)) continue;
      grounded.push({
        rule,
        evidencePath: c.evidence_path.trim(),
        evidenceSnippet: c.evidence_snippet.replace(/^\n+|\s+$/g, ''),
        confidence: normalizeConfidence(c.confidence),
      });
    }

    // 4. Re-scan: keep accepted rows, replace pending ones, never re-add an accepted rule.
    const existing = await this.store.list(workspaceId, repoId);
    const fresh = dedupeAgainstAccepted(
      grounded,
      existing.filter((r) => r.accepted),
    ).slice(0, MAX_CANDIDATES);
    await this.store.replacePending(workspaceId, repoId, fresh);

    return {
      candidates: await this.toDtos(repo, await this.store.list(workspaceId, repoId)),
      sample_count: sources.length + configs.length,
      dropped_count: data.conventions.length - grounded.length,
    };
  }

  private async readAll(clone: string, paths: string[]): Promise<{ path: string; text: string }[]> {
    const texts = await Promise.all(paths.map((p) => this.readFile(clone, p)));
    return paths.flatMap((path, i) => {
      const text = texts[i];
      return text === null || text === undefined || text.trim() === '' ? [] : [{ path, text }];
    });
  }

  async update(
    workspaceId: string,
    repoId: string,
    id: string,
    patch: ConventionPatch,
  ): Promise<ConventionCandidate> {
    const repo = await this.repo(workspaceId, repoId);
    const r = await this.store.update(workspaceId, repoId, id, patch);
    if (!r) throw new NotFoundError('Convention not found');
    const [dto] = await this.toDtos(repo, [r]);
    return dto!;
  }

  /** Reject = delete the candidate. */
  async reject(workspaceId: string, repoId: string, id: string): Promise<void> {
    await this.repo(workspaceId, repoId);
    if (!(await this.store.delete(workspaceId, repoId, id))) {
      throw new NotFoundError('Convention not found');
    }
  }

  /** Save a skill (type `convention`, source `extracted`) from accepted conventions only. */
  async createSkill(
    workspaceId: string,
    repoId: string,
    input: CreateConventionSkillInput,
  ): Promise<Skill> {
    await this.repo(workspaceId, repoId);
    const accepted = new Map(
      (await this.store.list(workspaceId, repoId)).filter((r) => r.accepted).map((r) => [r.id, r]),
    );
    const picked = [...new Set(input.conventionIds)].map((id) => accepted.get(id));
    if (picked.length === 0 || picked.some((r) => r === undefined)) {
      throw new ValidationError('A skill can only be built from accepted conventions of this repo');
    }
    const evidenceFiles = [...new Set(picked.map((r) => r!.evidencePath))];
    return this.skills.create(workspaceId, {
      name: input.name,
      description: input.description,
      type: 'convention',
      body: input.body,
      source: 'extracted',
      enabled: input.enabled,
      evidenceFiles,
      message: `Extracted from ${picked.length} accepted convention(s)`,
    });
  }
}
