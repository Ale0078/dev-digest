import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import { SmartDiffResponse } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

d('smart-diff route (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let prId: string;
  const llm = new MockLLMProvider('openai', {});

  const app = () =>
    buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: { embedder: new MockEmbedder(), git: new MockGitClient({ diff: '' }), llm: { openai: llm } },
    });

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const db = pg.handle.db;
    const [ws] = await db.select().from(t.workspaces);
    workspaceId = ws!.id;
    const [repo] = await db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'sd', fullName: 'acme/sd' })
      .returning();
    const [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 1,
        title: 'sd',
        author: 'a',
        branch: 'f',
        base: 'main',
        headSha: 'abc',
        filesCount: 4,
      })
      .returning();
    prId = pr!.id;
    await db.insert(t.prFiles).values(
      ['src/a.ts', 'src/a.test.ts', 'pnpm-lock.yaml', 'README.md'].map((path) => ({
        prId,
        path,
        additions: 1,
        deletions: 0,
        patch: null,
      })),
    );
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('groups files by role before any review, with empty finding_lines', async () => {
    const res = await (await app()).inject({ method: 'GET', url: `/pulls/${prId}/smart-diff` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(SmartDiffResponse.safeParse(body).success).toBe(true);
    expect(body.groups.map((g: { role: string }) => g.role)).toEqual([
      'core',
      'tests',
      'wiring',
      'docs',
      'boilerplate',
    ]);
    const boiler = body.groups.find((g: { role: string }) => g.role === 'boilerplate');
    expect(boiler.files.map((f: { path: string }) => f.path)).toEqual(['pnpm-lock.yaml']);
    for (const g of body.groups) for (const f of g.files) expect(f.finding_lines).toEqual([]);
  });

  it('uses only the latest review per agent for finding_lines', async () => {
    const db = pg.handle.db;
    const agentId = crypto.randomUUID();
    const mk = async (createdAt: Date, lines: number[]) => {
      const [rv] = await db
        .insert(t.reviews)
        .values({ workspaceId, prId, agentId, kind: 'review', createdAt })
        .returning();
      await db.insert(t.findings).values(
        lines.map((l) => ({
          reviewId: rv!.id,
          file: 'src/a.ts',
          startLine: l,
          endLine: l,
          severity: 'WARNING',
          category: 'bug',
          title: 't',
          rationale: 'r',
          confidence: 0.9,
        })),
      );
    };
    await mk(new Date('2026-01-01T00:00:00Z'), [99]);
    await mk(new Date('2026-01-02T00:00:00Z'), [12, 5, 12]);

    const res = await (await app()).inject({ method: 'GET', url: `/pulls/${prId}/smart-diff` });
    const core = res.json().groups.find((g: { role: string }) => g.role === 'core');
    expect(core.files.find((f: { path: string }) => f.path === 'src/a.ts').finding_lines).toEqual([5, 12]);
  });

  it('returns 404 not_found for an unknown PR', async () => {
    const res = await (await app()).inject({ method: 'GET', url: `/pulls/${crypto.randomUUID()}/smart-diff` });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('not_found');
  });

  it('makes no LLM call', () => {
    expect(llm.calls.length).toBe(0);
  });
});
