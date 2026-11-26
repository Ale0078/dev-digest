import type {
  Skill,
  SkillImportPreview,
  SkillSource,
  SkillStats,
  SkillType,
  SkillVersion,
} from '@devdigest/shared';
import {
  NotFoundError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../../platform/errors.js';
import {
  EMPTY_USAGE,
  acceptRate,
  pullRate,
  restoreMessage,
  skillBlock,
  snapshotContent,
  statsSince,
  toSkillDto,
  toSkillVersionDto,
} from './helpers.js';
import { SkillImportError, parseSkillImport } from './import-parser.js';
import type { SkillEdit, SkillRecord, SkillsStore, TokenCounter } from './types.js';

/**
 * Skills application service: CRUD + versioning + restore + stats + import
 * preview. Depends only on the `SkillsStore` port and a token counter.
 */

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  source: Extract<SkillSource, 'manual' | 'imported'>;
  enabled?: boolean;
  message?: string;
}

export interface UpdateSkillInput extends SkillEdit {
  message?: string;
}

export class SkillsService {
  constructor(
    private store: SkillsStore,
    private tokenizer: TokenCounter,
    private now: () => Date = () => new Date(),
  ) {}

  private since(): Date {
    return statsSince(this.now());
  }

  /** One skill → DTO with its own usage summary (3 grouped queries). */
  private async toDto(workspaceId: string, r: SkillRecord): Promise<Skill> {
    const usage = (await this.store.usageByWorkspace(workspaceId, this.since())).get(r.id);
    return toSkillDto(r, usage ?? EMPTY_USAGE, this.tokenizer.count(skillBlock(r)));
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const [records, usage] = await Promise.all([
      this.store.list(workspaceId),
      this.store.usageByWorkspace(workspaceId, this.since()),
    ]);
    return records.map((r) =>
      toSkillDto(r, usage.get(r.id) ?? EMPTY_USAGE, this.tokenizer.count(skillBlock(r))),
    );
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const r = await this.store.get(workspaceId, id);
    return r ? this.toDto(workspaceId, r) : undefined;
  }

  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    // Imported skills are someone else's instructions: always start disabled.
    const enabled = input.source === 'imported' ? false : (input.enabled ?? true);
    const r = await this.store.create(workspaceId, {
      name: input.name,
      description: input.description,
      type: input.type,
      body: input.body,
      source: input.source,
      enabled,
      message: input.message ?? null,
    });
    return this.toDto(workspaceId, r);
  }

  async update(
    workspaceId: string,
    id: string,
    input: UpdateSkillInput,
  ): Promise<Skill | undefined> {
    const { message, ...patch } = input;
    const r = await this.store.edit(workspaceId, id, patch, { message: message ?? null });
    return r ? this.toDto(workspaceId, r) : undefined;
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.store.delete(workspaceId, id);
  }

  async listVersions(workspaceId: string, id: string): Promise<SkillVersion[] | undefined> {
    const skill = await this.store.get(workspaceId, id);
    if (!skill) return undefined;
    return (await this.store.listVersions(id)).map(toSkillVersionDto);
  }

  /** New version with vN's content ("Restored vN"); history is never rewritten. */
  async restore(workspaceId: string, id: string, version: number): Promise<Skill> {
    const current = await this.store.get(workspaceId, id);
    if (!current) throw new NotFoundError('Skill not found');
    const snap = await this.store.getVersion(id, version);
    if (!snap) throw new NotFoundError('Skill version not found');
    const r = await this.store.edit(workspaceId, id, snapshotContent(snap, current), {
      message: restoreMessage(version),
      forceVersion: true,
    });
    if (!r) throw new NotFoundError('Skill not found');
    return this.toDto(workspaceId, r);
  }

  async stats(workspaceId: string, id: string): Promise<SkillStats | undefined> {
    const skill = await this.store.get(workspaceId, id);
    if (!skill) return undefined;
    const c = await this.store.stats(workspaceId, id, this.since());
    return {
      used_by: c.agentCount,
      pull_rate: pullRate(c),
      accept_rate: acceptRate(c),
      findings_30d: c.findings,
      agents: c.agents,
      by_category: c.byCategory,
    };
  }

  countTokens(text: string): number {
    return this.tokenizer.count(text);
  }

  /** Parse an uploaded .md/.zip into an editable preview. Persists nothing. */
  previewImport(filename: string, bytes: Uint8Array): SkillImportPreview {
    try {
      return parseSkillImport(filename, bytes);
    } catch (err) {
      if (err instanceof SkillImportError) {
        if (err.kind === 'unsupported_type') throw new UnsupportedMediaTypeError(err.message);
        throw new ValidationError(err.message);
      }
      throw err;
    }
  }
}
