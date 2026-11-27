import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import type { ChatMessage, ConventionCandidate, ConventionExtractResult } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockLLMProvider, MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';
import type { RepoIntel } from '../src/modules/repo-intel/types.js';
import * as t from '../src/db/schema.js';

/**
 * Conventions Extractor: code-picked samples → ONE structured model call →
 * evidence checked by code → stored candidates → accept/reject/edit → skill.
 */

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

const API_TS = [
  "import { http } from './http';",
  '',
  'export async function getUser(id: string) {',
  '  const res = await http.get(`/users/${id}`);',
  '  return res.data;',
  '}',
].join('\n');
const HTTP_TS = "import axios from 'axios';\nexport const http = axios.create({ baseURL: '/api' });\n";
const TSCONFIG = '{ "compilerOptions": { "strict": true } }\n';

const GROUNDED = {
  rule: 'HTTP calls go through the shared `http` instance, never raw axios',
  evidence_path: 'src/api/users.ts',
  evidence_snippet: '  const res = await http.get(`/users/${id}`);\n  return res.data;',
  confidence: 0.8,
};
const STRICT = {
  rule: 'TypeScript runs in strict mode',
  evidence_path: 'tsconfig.json',
  evidence_snippet: '{ "compilerOptions": { "strict": true } }',
  confidence: 0.9,
};
const INVENTED_SNIPPET = {
  rule: 'Errors are wrapped in AppError',
  evidence_path: 'src/api/users.ts',
  evidence_snippet: 'throw new AppError(err)',
  confidence: 0.7,
};
const UNSENT_FILE = {
  rule: 'Secrets live in .env',
  evidence_path: '.env',
  evidence_snippet: 'API_KEY=1',
  confidence: 0.6,
};

let seq = 0;

d('conventions extractor (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let clone: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
    clone = await mkdtemp(join(tmpdir(), 'dd-conventions-'));
    await mkdir(join(clone, 'src/api'), { recursive: true });
    await writeFile(join(clone, 'src/api/users.ts'), API_TS);
    await writeFile(join(clone, 'src/api/http.ts'), HTTP_TS);
    await writeFile(join(clone, 'tsconfig.json'), TSCONFIG);
    await writeFile(join(clone, '.env'), 'API_KEY=1\n');
  });
  afterAll(async () => {
    await pg?.stop();
    if (clone) await rm(clone, { recursive: true, force: true });
  });

  async function setup(fixture: unknown, opts: { clonePath?: string | null } = {}) {
    const n = seq++;
    const llm = new MockLLMProvider('openai', {
      structuredBySchema: { ConventionExtraction: fixture },
    });
    const sampled: { repoId: string; n: number }[] = [];
    const repoIntel = {
      getConventionSamples: async (repoId: string, count: number) => {
        sampled.push({ repoId, n: count });
        return ['src/api/users.ts', 'src/api/http.ts'];
      },
    } as unknown as RepoIntel;
    const app = await buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        llm: { openai: llm },
        repoIntel,
      },
    });
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name: `conv-${n}`,
        fullName: `acme/conv-${n}`,
        clonePath: opts.clonePath === undefined ? clone : opts.clonePath,
      })
      .returning();
    return { app, llm, sampled, repoId: repo!.id };
  }

  const extract = (s: Awaited<ReturnType<typeof setup>>) =>
    s.app.inject({ method: 'POST', url: `/repos/${s.repoId}/conventions/extract` });

  it('sends code-picked samples to ONE model call and drops candidates without evidence', async () => {
    const s = await setup({ conventions: [GROUNDED, STRICT, INVENTED_SNIPPET, UNSENT_FILE] });
    const res = await extract(s);
    expect(res.statusCode).toBe(200);
    const body = res.json() as ConventionExtractResult;

    expect(s.sampled).toEqual([{ repoId: s.repoId, n: 12 }]);
    const calls = s.llm.calls.filter((c) => c.method === 'completeStructured');
    expect(calls).toHaveLength(1);
    const req = calls[0]!.req as { schemaName: string; messages: ChatMessage[] };
    expect(req.schemaName).toBe('ConventionExtraction');
    const user = req.messages.find((m) => m.role === 'user')!.content;
    expect(user).toContain('<untrusted source="src/api/users.ts">');
    expect(user).toContain('<untrusted source="tsconfig.json">');
    expect(user).not.toContain('API_KEY'); // .env is never sampled

    expect(body.sample_count).toBe(3);
    expect(body.dropped_count).toBe(2);
    expect(body.candidates.map((c) => c.rule).sort()).toEqual([GROUNDED.rule, STRICT.rule].sort());
    const grounded = body.candidates.find((c) => c.rule === GROUNDED.rule)!;
    expect(grounded).toMatchObject({
      evidence_path: 'src/api/users.ts',
      evidence_line_start: 4,
      evidence_line_end: 5,
      accepted: false,
      confidence: 0.8,
    });

    const list = (await s.app.inject({ method: 'GET', url: `/repos/${s.repoId}/conventions` })).json();
    expect(list).toHaveLength(2);
  });

  it('accepts, edits and rejects a candidate; re-scan keeps accepted ones without duplicates', async () => {
    const s = await setup({ conventions: [GROUNDED, STRICT] });
    const first = (await extract(s)).json() as ConventionExtractResult;
    const http = first.candidates.find((c) => c.rule === GROUNDED.rule)!;
    const strict = first.candidates.find((c) => c.rule === STRICT.rule)!;

    const patched = await s.app.inject({
      method: 'PATCH',
      url: `/repos/${s.repoId}/conventions/${http.id}`,
      payload: { accepted: true, rule: '  Use the shared http client.  ' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ accepted: true, rule: 'Use the shared http client.' });

    const rejected = await s.app.inject({
      method: 'DELETE',
      url: `/repos/${s.repoId}/conventions/${strict.id}`,
    });
    expect(rejected.statusCode).toBe(204);

    // Re-scan: the model reports the accepted convention again (same evidence) plus STRICT.
    const second = (await extract(s)).json() as ConventionExtractResult;
    const rules = second.candidates.map((c) => c.rule);
    expect(rules.filter((r) => r === 'Use the shared http client.')).toHaveLength(1);
    expect(rules).not.toContain(GROUNDED.rule);
    expect(second.candidates.filter((c) => c.accepted).map((c) => c.id)).toEqual([http.id]);
    expect(rules).toContain(STRICT.rule); // rejected = deleted, so it may come back as pending
  });

  it('builds a convention/extracted skill from accepted conventions only', async () => {
    const s = await setup({ conventions: [GROUNDED, STRICT] });
    const { candidates } = (await extract(s)).json() as { candidates: ConventionCandidate[] };
    const http = candidates.find((c) => c.rule === GROUNDED.rule)!;
    const strict = candidates.find((c) => c.rule === STRICT.rule)!;
    await s.app.inject({
      method: 'PATCH',
      url: `/repos/${s.repoId}/conventions/${http.id}`,
      payload: { accepted: true },
    });

    const payload = {
      name: 'repo-conventions',
      description: '1 house convention extracted from acme/conv',
      body: '# repo-conventions\n\n## http\nUse the shared http client.',
      enabled: true,
    };
    const withPending = await s.app.inject({
      method: 'POST',
      url: `/repos/${s.repoId}/conventions/skills`,
      payload: { ...payload, convention_ids: [http.id, strict.id] },
    });
    expect(withPending.statusCode).toBe(422);

    const badName = await s.app.inject({
      method: 'POST',
      url: `/repos/${s.repoId}/conventions/skills`,
      payload: { ...payload, name: 'Repo Conventions', convention_ids: [http.id] },
    });
    expect(badName.statusCode).toBe(422);

    const res = await s.app.inject({
      method: 'POST',
      url: `/repos/${s.repoId}/conventions/skills`,
      payload: { ...payload, convention_ids: [http.id] },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: 'repo-conventions',
      type: 'convention',
      source: 'extracted',
      enabled: true,
      body: payload.body,
      evidence_files: ['src/api/users.ts'],
    });
    const [row] = await pg.handle.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.id, res.json().id as string));
    expect(row).toMatchObject({ type: 'convention', source: 'extracted' });
  });

  it('reports clear errors: unknown repo, not cloned, model failure', async () => {
    const s = await setup({ conventions: [] });
    const missing = await s.app.inject({
      method: 'POST',
      url: '/repos/00000000-0000-4000-8000-000000000000/conventions/extract',
    });
    expect(missing.statusCode).toBe(404);

    const notCloned = await setup({ conventions: [] }, { clonePath: null });
    const nc = await extract(notCloned);
    expect(nc.statusCode).toBe(422);
    expect(nc.json().error.message).toMatch(/not cloned/);
    expect(notCloned.llm.calls).toHaveLength(0);

    const broken = await setup({ conventions: [{ rule: 1 }] }); // fixture fails the schema → provider throws
    const br = await extract(broken);
    expect(br.statusCode).toBe(502);
    expect(br.json().error.message).toMatch(/conventions model call failed/);
  });
});
