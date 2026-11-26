import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import type { ChatMessage, Review } from '@devdigest/shared';

/**
 * M2 run path: effective skills (skills.enabled && agent_skills.enabled, in link
 * order) are rendered into the SYSTEM message, recorded in run_skills, and
 * surfaced in the trace (config.skills + prompt_assembly.skills_tokens).
 */

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

const REVIEW_FIXTURE: Review = {
  verdict: 'comment',
  summary: 'ok',
  score: 90,
  findings: [],
};

let seq = 0;

d('M2 skills in the review run path (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  async function setup() {
    const n = seq++;
    const llm = new MockLLMProvider('openai', { structured: REVIEW_FIXTURE });
    const app = await buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        llm: { openai: llm },
      },
    });
    const db = pg.handle.db;
    const [repo] = await db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: `skills-${n}`, fullName: `acme/skills-${n}` })
      .returning();
    const [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 900 + n,
        title: 'Skills run',
        author: 'a',
        branch: 'feat/s',
        base: 'main',
        headSha: `sha${n}`,
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
      })
      .returning();
    await db.insert(t.prFiles).values({
      prId: pr!.id,
      path: 'src/config.ts',
      additions: 1,
      deletions: 0,
      patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
    });
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: {
          name: `Skilled ${n}`,
          provider: 'openai',
          model: 'gpt-4.1',
          system_prompt: 'AGENT PROMPT',
        },
      })
    ).json() as { id: string };
    return { app, llm, pr: pr!, agent };
  }

  async function insertSkill(name: string, opts: { enabled?: boolean; version?: number } = {}) {
    const [s] = await pg.handle.db
      .insert(t.skills)
      .values({
        workspaceId,
        name,
        description: `${name} description`,
        type: 'rubric',
        source: 'manual',
        body: `${name} BODY`,
        enabled: opts.enabled ?? true,
        version: opts.version ?? 1,
      })
      .returning();
    return s!;
  }

  async function runReview(
    s: Awaited<ReturnType<typeof setup>>,
  ): Promise<{ runId: string; systems: string[] }> {
    const res = await s.app.inject({
      method: 'POST',
      url: `/pulls/${s.pr.id}/review`,
      payload: { agentId: s.agent.id },
    });
    expect(res.statusCode).toBe(200);
    const runId = res.json().runs[0].run_id as string;
    const [run] = await waitForPrRuns(pg.handle.db, s.pr.id, { expected: 1 });
    expect(run!.status).toBe('done');
    const systems = s.llm.calls
      .filter((c) => c.method === 'completeStructured')
      .map((c) => {
        const msgs = (c.req as { messages: ChatMessage[] }).messages;
        return msgs.find((m) => m.role === 'system')!.content as string;
      });
    expect(systems.length).toBeGreaterThan(0);
    return { runId, systems };
  }

  it('injects only effective skills, in link order, and records run_skills + trace fields', async () => {
    const s = await setup();
    const second = await insertSkill(`second-${seq}`, { version: 3 });
    const first = await insertSkill(`first-${seq}`);
    const globallyOff = await insertSkill(`global-off-${seq}`, { enabled: false });
    const linkOff = await insertSkill(`link-off-${seq}`);
    await pg.handle.db.insert(t.agentSkills).values([
      { agentId: s.agent.id, skillId: first.id, order: 0 },
      { agentId: s.agent.id, skillId: globallyOff.id, order: 1 },
      { agentId: s.agent.id, skillId: second.id, order: 2 },
      { agentId: s.agent.id, skillId: linkOff.id, order: 3, enabled: false },
    ]);

    const { runId, systems } = await runReview(s);

    for (const system of systems) {
      expect(system).toContain('## Skills');
      const iFirst = system.indexOf(`### ${first.name}\n${first.description}\n\n${first.body}`);
      const iSecond = system.indexOf(`### ${second.name}`);
      expect(iFirst).toBeGreaterThan(system.indexOf('AGENT PROMPT'));
      expect(iSecond).toBeGreaterThan(iFirst);
      expect(system.indexOf('SECURITY')).toBeGreaterThan(iSecond);
      expect(system).not.toContain(globallyOff.name);
      expect(system).not.toContain(linkOff.name);
    }

    const rows = await pg.handle.db.select().from(t.runSkills).where(eq(t.runSkills.runId, runId));
    expect(rows.map((r) => [r.skillId, r.skillVersion]).sort()).toEqual(
      [
        [first.id, 1],
        [second.id, 3],
      ].sort(),
    );

    const trace = (await s.app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    expect(trace.config.skills).toEqual([
      { id: first.id, name: first.name, version: 1 },
      { id: second.id, name: second.name, version: 3 },
    ]);
    expect(trace.prompt_assembly.skills).toContain(`### ${first.name}`);
    expect(trace.prompt_assembly.system).not.toContain('## Skills');
    expect(trace.prompt_assembly.skills_tokens).toBeGreaterThan(0);
    expect(
      trace.log.some((l: { msg: string }) =>
        l.msg.startsWith(`skills: 2 attached (${first.name} v1, ${second.name} v3) · `),
      ),
    ).toBe(true);

    await s.app.close();
  });

  it('with no effective skills the system message has no ## Skills and nothing is recorded', async () => {
    const s = await setup();
    const off = await insertSkill(`only-off-${seq}`, { enabled: false });
    await pg.handle.db.insert(t.agentSkills).values({ agentId: s.agent.id, skillId: off.id, order: 0 });

    const { runId, systems } = await runReview(s);
    for (const system of systems) expect(system).not.toContain('## Skills');

    const rows = await pg.handle.db.select().from(t.runSkills).where(eq(t.runSkills.runId, runId));
    expect(rows).toHaveLength(0);

    const trace = (await s.app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    expect(trace.config.skills).toBeNull();
    expect(trace.prompt_assembly.skills).toBeNull();
    expect(trace.prompt_assembly.skills_tokens).toBeNull();
    expect(trace.log.some((l: { msg: string }) => l.msg.startsWith('skills:'))).toBe(false);

    await s.app.close();
  });

  it('loads a pre-M2 trace (no config.skills / skills_tokens) with nulls', async () => {
    const s = await setup();
    const [run] = await pg.handle.db
      .insert(t.agentRuns)
      .values({ workspaceId, agentId: s.agent.id, prId: s.pr.id, status: 'done', source: 'local' })
      .returning();
    // Shape written before M2 (and before M1: no cost_usd either).
    const oldTrace = {
      config: { agent: 'Old', version: '1', provider: 'openai', model: 'gpt-4.1', pr: 1, source: 'local' },
      stats: { duration_ms: 1, tokens_in: 1, tokens_out: 1, findings: 0, grounding: '0/0 passed' },
      prompt_assembly: { system: 's', skills: null, memory: null, specs: null, user: 'u' },
      tool_calls: [],
      raw_output: '',
      memory_pulled: [],
      specs_read: [],
      log: [],
    };
    await pg.handle.db.insert(t.runTraces).values({ runId: run!.id, trace: oldTrace as never });

    const res = await s.app.inject({ method: 'GET', url: `/runs/${run!.id}/trace` });
    expect(res.statusCode).toBe(200);
    const trace = res.json();
    expect(trace.config.skills).toBeNull();
    expect(trace.prompt_assembly.skills_tokens).toBeNull();
    expect(trace.stats.cost_usd).toBeNull();

    await s.app.close();
  });
});
