import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
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
  console.warn('[agents-skills] Docker not available — skipping integration tests.');
}

/**
 * `POST /agents/:id/skills` — the `items` (ordered + per-agent enabled),
 * `skill_ids` and `skill_id` variants, and the workspace check on skill ids.
 */
d('POST /agents/:id/skills', () => {
  let pg: PgFixture;
  let app: FastifyInstance;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
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
  async function skill(): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { name: `s-${++n}`, type: 'custom', body: 'body' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id;
  }
  async function agent(): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name: `a-${++n}`, provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'Review.' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id;
  }
  const post = (agentId: string, payload: unknown) =>
    app.inject({ method: 'POST', url: `/agents/${agentId}/skills`, payload: payload as object });
  const links = async (agentId: string) =>
    (await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json();

  it('items: replaces links in order with per-agent enabled', async () => {
    const [a, s1, s2, s3] = [await agent(), await skill(), await skill(), await skill()];
    await post(a, { skill_ids: [s1] });

    const res = await post(a, {
      items: [
        { skill_id: s3, enabled: true },
        { skill_id: s1, enabled: false },
        { skill_id: s2, enabled: true },
      ],
    });
    expect(res.statusCode).toBe(200);
    const expected = [
      { agent_id: a, skill_id: s3, order: 0, enabled: true },
      { agent_id: a, skill_id: s1, order: 1, enabled: false },
      { agent_id: a, skill_id: s2, order: 2, enabled: true },
    ];
    expect(res.json()).toEqual(expected);
    expect(await links(a)).toEqual(expected);

    // agent_count on the skill card counts ENABLED links only.
    const list = (await app.inject({ method: 'GET', url: '/skills' })).json() as {
      id: string;
      agent_count: number;
    }[];
    expect(list.find((x) => x.id === s1)!.agent_count).toBe(0);
    expect(list.find((x) => x.id === s3)!.agent_count).toBe(1);

    expect((await post(a, { items: [] })).json()).toEqual([]);
  });

  it('skill_ids (compat) links all enabled; skill_id appends one', async () => {
    const [a, s1, s2] = [await agent(), await skill(), await skill()];
    expect((await post(a, { skill_ids: [s2, s1] })).json()).toEqual([
      { agent_id: a, skill_id: s2, order: 0, enabled: true },
      { agent_id: a, skill_id: s1, order: 1, enabled: true },
    ]);
    const s3 = await skill();
    const res = await post(a, { skill_id: s3 });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(3);
    expect(res.json()[2]).toEqual({ agent_id: a, skill_id: s3, order: 2, enabled: true });
  });

  it('rejects a skill from another workspace (404) and writes nothing', async () => {
    const [a, own] = [await agent(), await skill()];
    await post(a, { skill_ids: [own] });

    const [ws] = await pg.handle.db.insert(t.workspaces).values({ name: `foreign-${++n}` }).returning();
    const [foreign] = await pg.handle.db
      .insert(t.skills)
      .values({ workspaceId: ws!.id, name: 'foreign', description: '', type: 'custom', source: 'manual', body: 'x' })
      .returning();

    for (const payload of [
      { items: [{ skill_id: own, enabled: true }, { skill_id: foreign!.id, enabled: true }] },
      { skill_ids: [foreign!.id] },
      { skill_id: foreign!.id },
    ]) {
      const res = await post(a, payload);
      expect(res.statusCode).toBe(404);
      expect(res.json().error.message).toBe('Skill not found');
    }
    expect(await links(a)).toEqual([{ agent_id: a, skill_id: own, order: 0, enabled: true }]);
  });

  it('422 on duplicate skill ids; 404 for an unknown agent', async () => {
    const [a, s1] = [await agent(), await skill()];
    const dup = await post(a, {
      items: [
        { skill_id: s1, enabled: true },
        { skill_id: s1, enabled: false },
      ],
    });
    expect(dup.statusCode).toBe(422);
    const missing = await post('00000000-0000-0000-0000-000000000000', { skill_ids: [s1] });
    expect(missing.statusCode).toBe(404);
  });
});
