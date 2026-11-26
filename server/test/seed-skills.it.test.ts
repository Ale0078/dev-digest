import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, asc, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { seed, REFUND_FIXTURE, TEST_QUALITY_AGENT_NAME } from '../src/db/seed.js';
import { SEED_SKILLS, TEST_QUALITY_REVIEWER_PROMPT } from '../src/db/seed-prompts.js';
import { parseUnifiedDiff } from '../src/adapters/git/diff-parser.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[seed-skills] Docker not available — skipping integration tests.');
}

/**
 * M2 seed: Test Quality Reviewer + its three manual skills (v1 snapshot rows,
 * linked in order) + the skills control-experiment PR with real patches. The
 * seed runs twice, so every assertion also proves idempotency.
 */
d('seed: Test Quality Reviewer, skills, fixture PR', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    ({ workspaceId } = await seed(pg.handle.db));
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  async function agent() {
    const rows = await pg.handle.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, TEST_QUALITY_AGENT_NAME)));
    expect(rows).toHaveLength(1);
    return rows[0]!;
  }

  it('seeds Test Quality Reviewer exactly once with its prompt', async () => {
    const a = await agent();
    expect(a.systemPrompt).toBe(TEST_QUALITY_REVIEWER_PROMPT);
    expect(a.provider).toBe('openrouter');
    expect(a.enabled).toBe(true);
  });

  it('seeds each skill once as manual v1 with a full "Seeded" v1 snapshot', async () => {
    const db = pg.handle.db;
    const skills = await db.select().from(t.skills).where(eq(t.skills.workspaceId, workspaceId));
    expect(skills.map((s) => s.name).sort()).toEqual(SEED_SKILLS.map((s) => s.name).sort());

    for (const expected of SEED_SKILLS) {
      const s = skills.find((x) => x.name === expected.name)!;
      expect(s).toMatchObject({
        type: expected.type,
        description: expected.description,
        body: expected.body,
        source: 'manual',
        enabled: true,
        version: 1,
      });
      const versions = await db
        .select()
        .from(t.skillVersions)
        .where(eq(t.skillVersions.skillId, s.id));
      expect(versions).toHaveLength(1);
      expect(versions[0]).toMatchObject({
        version: 1,
        name: expected.name,
        description: expected.description,
        type: expected.type,
        body: expected.body,
        message: 'Seeded',
      });
    }
  });

  it('links the skills to the agent in seed order, all enabled', async () => {
    const a = await agent();
    const links = await pg.handle.db
      .select({ name: t.skills.name, order: t.agentSkills.order, enabled: t.agentSkills.enabled })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.skills.id, t.agentSkills.skillId))
      .where(eq(t.agentSkills.agentId, a.id))
      .orderBy(asc(t.agentSkills.order));
    expect(links).toEqual([
      { name: 'branch-coverage-gate', order: 0, enabled: true },
      { name: 'corner-case-checklist', order: 1, enabled: true },
      { name: 'mocking-smells', order: 2, enabled: true },
    ]);
  });

  it('seeds the fixture PR once, with well-formed patches the diff parser accepts', async () => {
    const db = pg.handle.db;
    const prs = await db
      .select()
      .from(t.pullRequests)
      .where(
        and(
          eq(t.pullRequests.workspaceId, workspaceId),
          eq(t.pullRequests.number, REFUND_FIXTURE.number),
        ),
      );
    expect(prs).toHaveLength(1);
    const pr = prs[0]!;
    expect(pr.title).toBe('Add refund amount validation');

    const files = await db.select().from(t.prFiles).where(eq(t.prFiles.prId, pr.id));
    expect(files).toHaveLength(3);
    expect(pr.filesCount).toBe(3);
    expect(pr.additions).toBe(files.reduce((n, f) => n + f.additions, 0));
    expect(pr.deletions).toBe(files.reduce((n, f) => n + f.deletions, 0));

    // Same reconstruction as reviews/diff-loader.ts `diffFromPrFiles`.
    const raw = files
      .map((f) => [`diff --git a/${f.path} b/${f.path}`, `--- a/${f.path}`, `+++ b/${f.path}`, f.patch!])
      .flat()
      .join('\n');
    const diff = parseUnifiedDiff(raw);
    expect(diff.files.map((f) => f.path).sort()).toEqual(files.map((f) => f.path).sort());
    for (const f of files) {
      expect(f.patch).toBeTruthy();
      const parsed = diff.files.find((x) => x.path === f.path)!;
      expect(parsed.additions).toBe(f.additions);
      expect(parsed.deletions).toBe(f.deletions);
      for (const h of parsed.hunks) {
        // header new-side count must equal the lines the body actually covers
        expect(h.newLineNumbers).toHaveLength(h.newLines);
      }
    }
    // the boundary line the control experiment hinges on is citable
    const src = diff.files.find((f) => f.path === 'src/refunds/validate-refund.ts')!;
    // whole-file hunk: index 0 is the `@@` header, so index i is new-file line i
    const boundaryLine = REFUND_FIXTURE.files[0]!.patch
      .split('\n')
      .indexOf('+  if (req.amountCents > maxRefund) {');
    expect(boundaryLine).toBeGreaterThan(0);
    expect(src.hunks[0]!.newLineNumbers).toContain(boundaryLine);

    const commits = await db.select().from(t.prCommits).where(eq(t.prCommits.prId, pr.id));
    expect(commits).toHaveLength(REFUND_FIXTURE.commits.length);
  });
});
