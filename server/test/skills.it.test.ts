import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { strToU8, zipSync } from 'fflate';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

/** Build a single-file multipart body for app.inject. */
function multipart(filename: string, content: Uint8Array, field = 'file') {
  const boundary = '----devdigest-test-boundary';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\n` +
      'Content-Type: application/octet-stream\r\n\r\n',
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, Buffer.from(content), tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

const SKILL_MD = `---
name: flaky-test-patterns
description: Flag sleeps and order-dependent tests.
type: custom
---
# Flaky tests
- No sleeps.
`;

d('skills module', () => {
  let pg: PgFixture;
  let app: FastifyInstance;
  let workspaceId: string;
  let prId: string;

  beforeAll(async () => {
    pg = await startPg();
    ({ workspaceId } = await seed(pg.handle.db));
    const [pr] = await pg.handle.db.select({ id: t.pullRequests.id }).from(t.pullRequests).limit(1);
    prId = pr!.id;
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  });
  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  let n = 0;
  async function createSkill(over: Record<string, unknown> = {}) {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { name: `skill-${++n}`, type: 'rubric', body: 'Check every branch.', ...over },
    });
    expect(res.statusCode).toBe(201);
    return res.json();
  }

  async function createAgent(name: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name, provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'Review.' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id;
  }

  async function countRows() {
    const [s] = await pg.handle.db.select({ n: sql<number>`count(*)::int` }).from(t.skills);
    const [v] = await pg.handle.db.select({ n: sql<number>`count(*)::int` }).from(t.skillVersions);
    return { skills: s!.n, versions: v!.n };
  }

  it('creates a skill at v1 with a full snapshot and card fields', async () => {
    const skill = await createSkill({ name: 'branch-coverage-gate', description: 'Gate.', message: 'init' });
    expect(skill).toMatchObject({
      name: 'branch-coverage-gate',
      description: 'Gate.',
      type: 'rubric',
      source: 'manual',
      enabled: true,
      version: 1,
      agent_count: 0,
      stats: { pull_rate: null, accept_rate: null },
    });
    expect(skill.body_tokens).toBeGreaterThan(0);
    expect(typeof skill.updated_at).toBe('string');

    const versions = (await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` })).json();
    expect(versions).toEqual([
      expect.objectContaining({
        skill_id: skill.id,
        version: 1,
        name: 'branch-coverage-gate',
        description: 'Gate.',
        type: 'rubric',
        body: 'Check every branch.',
        message: 'init',
      }),
    ]);

    const one = await app.inject({ method: 'GET', url: `/skills/${skill.id}` });
    expect(one.statusCode).toBe(200);
    expect(one.json().id).toBe(skill.id);
  });

  it('an imported skill always starts disabled; description defaults to empty', async () => {
    const skill = await createSkill({ source: 'imported', enabled: true });
    expect(skill.enabled).toBe(false);
    expect(skill.source).toBe('imported');
    expect(skill.description).toBe('');
  });

  it('lists workspace skills newest updated_at first', async () => {
    const a = await createSkill();
    const b = await createSkill();
    await app.inject({ method: 'PUT', url: `/skills/${a.id}`, payload: { enabled: false } });
    const list = (await app.inject({ method: 'GET', url: '/skills' })).json() as { id: string }[];
    const ids = list.map((s) => s.id);
    expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(b.id));
  });

  it('content edits bump the version; toggling enabled or a no-op edit does not', async () => {
    const skill = await createSkill();

    const toggled = (
      await app.inject({ method: 'PUT', url: `/skills/${skill.id}`, payload: { enabled: false } })
    ).json();
    expect(toggled).toMatchObject({ enabled: false, version: 1 });
    expect(new Date(toggled.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(skill.updated_at).getTime(),
    );

    const same = (
      await app.inject({ method: 'PUT', url: `/skills/${skill.id}`, payload: { body: skill.body } })
    ).json();
    expect(same.version).toBe(1);

    const edited = await app.inject({
      method: 'PUT',
      url: `/skills/${skill.id}`,
      payload: { body: 'Check every branch and early return.', message: 'tighten' },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({ version: 2, body: 'Check every branch and early return.' });

    const versions = (await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` })).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versions[0]).toMatchObject({ message: 'tighten', body: 'Check every branch and early return.' });
  });

  it('a change note without a content change annotates the current version', async () => {
    const skill = await createSkill({ message: 'init' });
    const res = await app.inject({
      method: 'PUT',
      url: `/skills/${skill.id}`,
      payload: { body: skill.body, message: 'clarify intent' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe(1);
    const versions = (await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` })).json();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 1, message: 'clarify intent' });
  });

  it('restore creates a NEW version with the old content', async () => {
    const skill = await createSkill({ body: 'v1 body', description: 'v1 desc' });
    await app.inject({
      method: 'PUT',
      url: `/skills/${skill.id}`,
      payload: { body: 'v2 body', description: 'v2 desc', type: 'security' },
    });
    const restored = await app.inject({ method: 'POST', url: `/skills/${skill.id}/versions/1/restore` });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({
      version: 3,
      body: 'v1 body',
      description: 'v1 desc',
      type: 'rubric',
    });
    const versions = (await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` })).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);
    expect(versions[0].message).toBe('Restored v1');

    const missing = await app.inject({ method: 'POST', url: `/skills/${skill.id}/versions/99/restore` });
    expect(missing.statusCode).toBe(404);
  });

  it('restoring a pre-M2 snapshot falls back to current values for null fields', async () => {
    const skill = await createSkill({ name: 'legacy', description: 'now' });
    // Old-style row: body only.
    await pg.handle.db.insert(t.skillVersions).values({ skillId: skill.id, version: 7, body: 'old body' });
    const restored = (
      await app.inject({ method: 'POST', url: `/skills/${skill.id}/versions/7/restore` })
    ).json();
    expect(restored).toMatchObject({ name: 'legacy', description: 'now', type: 'rubric', body: 'old body' });
    expect(restored.version).toBe(2);
  });

  it('delete → 204, then 404; agent links cascade', async () => {
    const skill = await createSkill();
    const agentId = await createAgent('Cascade Agent');
    await app.inject({ method: 'POST', url: `/agents/${agentId}/skills`, payload: { skill_ids: [skill.id] } });

    const del = await app.inject({ method: 'DELETE', url: `/skills/${skill.id}` });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/skills/${skill.id}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/skills/${skill.id}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json()).toEqual([]);
  });

  it('404s for unknown ids and for skills of another workspace', async () => {
    const [other] = await pg.handle.db.insert(t.workspaces).values({ name: 'other-ws' }).returning();
    const [foreign] = await pg.handle.db
      .insert(t.skills)
      .values({ workspaceId: other!.id, name: 'foreign', description: '', type: 'custom', source: 'manual', body: 'x' })
      .returning();
    for (const url of [`/skills/${foreign!.id}`, `/skills/${foreign!.id}/versions`, `/skills/${foreign!.id}/stats`]) {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404);
    }
    const put = await app.inject({ method: 'PUT', url: `/skills/${foreign!.id}`, payload: { enabled: false } });
    expect(put.statusCode).toBe(404);
    const list = (await app.inject({ method: 'GET', url: '/skills' })).json() as { id: string }[];
    expect(list.map((s) => s.id)).not.toContain(foreign!.id);
    expect((await app.inject({ method: 'GET', url: '/skills/not-a-uuid' })).statusCode).toBe(422);
  });

  it('token-count uses the server tokenizer', async () => {
    const res = await app.inject({ method: 'POST', url: '/skills/token-count', payload: { text: 'hello world' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().tokens).toBeGreaterThan(0);
    const empty = await app.inject({ method: 'POST', url: '/skills/token-count', payload: { text: '' } });
    expect(empty.json()).toEqual({ tokens: 0 });
  });

  describe('import preview', () => {
    it('parses .md and .zip, lists ignored files, and writes nothing', async () => {
      const before = await countRows();

      const mdRes = await app.inject({
        method: 'POST',
        url: '/skills/import/preview',
        ...multipart('flaky.md', strToU8(SKILL_MD)),
      });
      expect(mdRes.statusCode).toBe(200);
      expect(mdRes.json()).toMatchObject({
        name: 'flaky-test-patterns',
        description: 'Flag sleeps and order-dependent tests.',
        type: 'custom',
        ignored_files: [],
      });

      const zip = zipSync({
        'SKILL.md': strToU8(SKILL_MD),
        'scripts/run.sh': strToU8('#!/bin/sh\necho pwned\n'),
      });
      const zipRes = await app.inject({
        method: 'POST',
        url: '/skills/import/preview',
        ...multipart('flaky-test-patterns.zip', zip),
      });
      expect(zipRes.statusCode).toBe(200);
      expect(zipRes.json()).toMatchObject({ name: 'flaky-test-patterns', ignored_files: ['scripts/run.sh'] });

      expect(await countRows()).toEqual(before);
    });

    it('415 for other extensions or a non-multipart body; 422 for a zip without SKILL.md', async () => {
      const txt = await app.inject({
        method: 'POST',
        url: '/skills/import/preview',
        ...multipart('skill.txt', strToU8('hi')),
      });
      expect(txt.statusCode).toBe(415);
      expect(txt.json().error.code).toBe('unsupported_media_type');

      const json = await app.inject({ method: 'POST', url: '/skills/import/preview', payload: { a: 1 } });
      expect(json.statusCode).toBe(415);

      const noSkill = await app.inject({
        method: 'POST',
        url: '/skills/import/preview',
        ...multipart('s.zip', zipSync({ 'README.md': strToU8('r') })),
      });
      expect(noSkill.statusCode).toBe(422);
      expect(noSkill.json().error.code).toBe('validation_error');

      const wrongField = await app.inject({
        method: 'POST',
        url: '/skills/import/preview',
        ...multipart('a.md', strToU8(SKILL_MD), 'upload'),
      });
      expect(wrongField.statusCode).toBe(422);
    });

    it('413 for an upload over 1 MB', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/skills/import/preview',
        ...multipart('big.md', new Uint8Array(1_048_576 + 10).fill(97)),
      });
      expect(res.statusCode).toBe(413);
    });
  });

  describe('stats', () => {
    it('computes 30-day pull/accept rates, findings and categories from run_skills', async () => {
      const db = pg.handle.db;
      const skill = await createSkill({ name: 'stats-skill' });
      const linked = await createAgent('Stats Linked');
      const disabledLink = await createAgent('Stats Disabled Link');
      await app.inject({
        method: 'POST',
        url: `/agents/${linked}/skills`,
        payload: { items: [{ skill_id: skill.id, enabled: true }] },
      });
      await app.inject({
        method: 'POST',
        url: `/agents/${disabledLink}/skills`,
        payload: { items: [{ skill_id: skill.id, enabled: false }] },
      });

      const run = async (agentId: string, opts: { status?: string; daysAgo?: number; withSkill?: boolean }) => {
        const ranAt = new Date(Date.now() - (opts.daysAgo ?? 1) * 86_400_000);
        const [r] = await db
          .insert(t.agentRuns)
          .values({ workspaceId, agentId, prId, status: opts.status ?? 'done', source: 'local', ranAt })
          .returning();
        if (opts.withSkill) {
          await db.insert(t.runSkills).values({ runId: r!.id, skillId: skill.id, skillVersion: 1 });
        }
        return r!.id;
      };
      const addFindings = async (runId: string, rows: { category: string; accepted?: boolean; dismissed?: boolean }[]) => {
        const [review] = await db
          .insert(t.reviews)
          .values({ workspaceId, prId, agentId: null, runId, kind: 'review' })
          .returning();
        await db.insert(t.findings).values(
          rows.map((f, i) => ({
            reviewId: review!.id,
            file: 'src/a.ts',
            startLine: i + 1,
            endLine: i + 1,
            severity: 'WARNING',
            category: f.category,
            title: `f${i}`,
            rationale: 'r',
            confidence: 0.9,
            acceptedAt: f.accepted ? new Date() : null,
            dismissedAt: f.dismissed ? new Date() : null,
          })),
        );
      };

      const r1 = await run(linked, { withSkill: true });
      await run(linked, {}); // done, skill not injected
      await run(disabledLink, {}); // done, linked (disabled) agent
      const failed = await run(linked, { status: 'failed', withSkill: true }); // not a done run
      const old = await run(linked, { daysAgo: 40, withSkill: true }); // outside the window
      await addFindings(r1, [
        { category: 'security', accepted: true },
        { category: 'security', accepted: true },
        { category: 'style', dismissed: true },
        { category: 'security' },
      ]);
      await addFindings(old, [{ category: 'style', dismissed: true }]);
      void failed;

      const stats = await app.inject({ method: 'GET', url: `/skills/${skill.id}/stats` });
      expect(stats.statusCode).toBe(200);
      const s = stats.json();
      expect(s).toMatchObject({
        used_by: 1,
        findings_30d: 4,
        agents: [{ id: linked, name: 'Stats Linked' }],
        by_category: [
          { category: 'security', count: 3 },
          { category: 'style', count: 1 },
        ],
      });
      expect(s.pull_rate).toBeCloseTo(1 / 3);
      expect(s.accept_rate).toBeCloseTo(2 / 3);

      const card = ((await app.inject({ method: 'GET', url: '/skills' })).json() as {
        id: string;
        agent_count: number;
        stats: { pull_rate: number; accept_rate: number };
      }[]).find((x) => x.id === skill.id)!;
      expect(card.agent_count).toBe(1);
      expect(card.stats.pull_rate).toBeCloseTo(1 / 3);
      expect(card.stats.accept_rate).toBeCloseTo(2 / 3);
      const one = (await app.inject({ method: 'GET', url: `/skills/${skill.id}` })).json();
      expect(one.stats).toEqual(card.stats);
    });

    it('returns null rates and zero counts when there is no data', async () => {
      const skill = await createSkill();
      const s = (await app.inject({ method: 'GET', url: `/skills/${skill.id}/stats` })).json();
      expect(s).toEqual({
        used_by: 0,
        pull_rate: null,
        accept_rate: null,
        findings_30d: 0,
        agents: [],
        by_category: [],
      });
    });
  });
});
