import 'dotenv/config';
import { createDb, type Db } from './client.js';
import * as t from './schema.js';
import { eq, and } from 'drizzle-orm';
import {
  GENERAL_REVIEWER_PROMPT,
  SECURITY_REVIEWER_PROMPT,
  PERFORMANCE_REVIEWER_PROMPT,
  TEST_QUALITY_REVIEWER_PROMPT,
  SEED_SKILLS,
} from './seed-prompts.js';

/** Default provider/model for the built-in reviewer agents. */
const DEFAULT_PROVIDER = 'openrouter' as const;
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

/**
 * Seed the starter's demo data. Idempotent: re-running upserts the default
 * workspace/user and the demo fixtures.
 *
 * Seeds: default workspace + system user + membership, default settings,
 * demo repo (acme/payments-api), PR #482 with files/commits, a sample review
 * with a few findings, the skills control-experiment PR #483 (`REFUND_FIXTURE`),
 * the four built-in agents (General + Security + Performance + Test Quality), all
 * on the default openrouter/deepseek-v4-flash provider+model, and three manual
 * skills (`SEED_SKILLS`) linked in order to Test Quality Reviewer.
 *
 * Later milestones populate the other tables (conventions, memory, eval, …) once
 * their features are built — they start empty here.
 */

/**
 * Build one unified-diff hunk (GitHub `patch` style: no file headers). The
 * `@@ -a,b +c,d @@` counts are derived from the line prefixes (' ', '+', '-') so
 * the header can never disagree with the body — grounding relies on it.
 */
export function hunk(oldStart: number, newStart: number, lines: string[]): string {
  const oldLines = lines.filter((l) => !l.startsWith('+')).length;
  const newLines = lines.filter((l) => !l.startsWith('-')).length;
  return [`@@ -${oldStart},${oldLines} +${newStart},${newLines} @@`, ...lines].join('\n');
}

/** Whole-file addition as a single hunk. */
function addedFile(lines: string[]): string {
  return hunk(0, 1, lines.map((l) => `+${l}`));
}

/**
 * Skills control-experiment fixture (M2): the code adds a new early return, two
 * rejection branches and a boundary (`amountCents > maxRefund`, `<= 0`), but the
 * test covers only the happy path. Test Quality Reviewer without skills tends to
 * miss the uncovered branches; with the seeded skills it should flag them.
 */
export const REFUND_FIXTURE = {
  number: 483,
  title: 'Add refund amount validation',
  author: 'dev.patel',
  branch: 'feat/refund-validation',
  headSha: 'c4d5e6f7a8b9',
  body:
    'Validate refund requests against the original charge before calling the payment provider. ' +
    'Rejects non-refundable charges, non-positive amounts and amounts above the remaining refundable ' +
    'balance; a fully refunded charge short-circuits with nothing to refund.',
  commits: [
    { sha: 'b3c4d5e6f7a8', message: 'Add validateRefund with charge and amount checks' },
    { sha: 'c4d5e6f7a8b9', message: 'Use validateRefund in POST /refunds and add a test' },
  ],
  files: [
    {
      path: 'src/refunds/validate-refund.ts',
      patch: addedFile([
        "export type RefundErrorCode = 'CHARGE_NOT_REFUNDABLE' | 'INVALID_AMOUNT' | 'AMOUNT_EXCEEDS_CHARGE';",
        '',
        'export class RefundError extends Error {',
        '  constructor(',
        '    readonly code: RefundErrorCode,',
        '    message: string,',
        '  ) {',
        '    super(message);',
        "    this.name = 'RefundError';",
        '  }',
        '}',
        '',
        'export interface RefundRequest {',
        '  chargeId: string;',
        '  amountCents: number;',
        '}',
        '',
        'export interface Charge {',
        '  id: string;',
        '  amountCents: number;',
        '  refundedCents: number;',
        "  status: 'succeeded' | 'pending' | 'failed';",
        '}',
        '',
        '/**',
        ' * Validate a refund request against the original charge and return the',
        ' * amount (in cents) that should be refunded. Returns 0 when the charge has',
        ' * already been fully refunded.',
        ' */',
        'export function validateRefund(req: RefundRequest, charge: Charge): number {',
        "  if (charge.status !== 'succeeded') {",
        "    throw new RefundError('CHARGE_NOT_REFUNDABLE', `charge ${charge.id} is ${charge.status}`);",
        '  }',
        '',
        '  const maxRefund = charge.amountCents - charge.refundedCents;',
        '  if (maxRefund === 0) return 0;',
        '',
        '  if (req.amountCents <= 0) {',
        "    throw new RefundError('INVALID_AMOUNT', 'refund amount must be positive');",
        '  }',
        '  if (req.amountCents > maxRefund) {',
        "    throw new RefundError('AMOUNT_EXCEEDS_CHARGE', `at most ${maxRefund} cents can be refunded`);",
        '  }',
        '',
        '  return req.amountCents;',
        '}',
      ]),
    },
    {
      path: 'src/api/refunds.ts',
      patch: hunk(1, 1, [
        " import type { FastifyInstance } from 'fastify';",
        " import { z } from 'zod';",
        " import { chargesRepo } from '../db/charges.js';",
        " import { refundsService } from '../services/refunds.js';",
        "+import { validateRefund, RefundError } from '../refunds/validate-refund.js';",
        ' ',
        ' const RefundBody = z.object({',
        '   chargeId: z.string(),',
        '   amountCents: z.number().int(),',
        ' });',
        ' ',
        ' export async function refundRoutes(app: FastifyInstance) {',
        "   app.post('/refunds', async (req, reply) => {",
        '     const body = RefundBody.parse(req.body);',
        '     const charge = await chargesRepo.get(body.chargeId);',
        '-    const refund = await refundsService.create(charge, body.amountCents);',
        '+',
        '+    let amountCents: number;',
        '+    try {',
        '+      amountCents = validateRefund(body, charge);',
        '+    } catch (err) {',
        '+      if (err instanceof RefundError) {',
        '+        return reply.code(422).send({ code: err.code, message: err.message });',
        '+      }',
        '+      throw err;',
        '+    }',
        '+    if (amountCents === 0) return reply.code(200).send({ refundedCents: 0 });',
        '+',
        '+    const refund = await refundsService.create(charge, amountCents);',
        '     return reply.code(201).send(refund);',
        '   });',
        ' }',
      ]),
    },
    {
      path: 'test/refunds/validate-refund.test.ts',
      patch: addedFile([
        "import { describe, it, expect } from 'vitest';",
        "import { validateRefund, type Charge } from '../../src/refunds/validate-refund.js';",
        '',
        'const charge: Charge = {',
        "  id: 'ch_1',",
        '  amountCents: 5000,',
        '  refundedCents: 1000,',
        "  status: 'succeeded',",
        '};',
        '',
        "describe('validateRefund', () => {",
        "  it('returns the requested amount for a valid partial refund', () => {",
        "    expect(validateRefund({ chargeId: 'ch_1', amountCents: 2500 }, charge)).toBe(2500);",
        '  });',
        '});',
      ]),
    },
  ],
};

/** Count `+` / `-` body lines of a GitHub-style patch (no file headers). */
function patchStats(patch: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const l of patch.split('\n')) {
    if (l.startsWith('@@')) continue;
    if (l.startsWith('+')) additions++;
    else if (l.startsWith('-')) deletions++;
  }
  return { additions, deletions };
}

export const TEST_QUALITY_AGENT_NAME = 'Test Quality Reviewer';

export const DEFAULT_WORKSPACE_NAME = 'default';
export const SYSTEM_USER_EMAIL = 'you@local';

export async function seed(db: Db): Promise<{ workspaceId: string; userId: string }> {
  // ---- workspace + user (no-auth defaults) ----
  let [ws] = await db
    .select()
    .from(t.workspaces)
    .where(eq(t.workspaces.name, DEFAULT_WORKSPACE_NAME));
  if (!ws) {
    [ws] = await db
      .insert(t.workspaces)
      .values({ name: DEFAULT_WORKSPACE_NAME })
      .returning();
  }
  const workspaceId = ws!.id;

  let [user] = await db.select().from(t.users).where(eq(t.users.email, SYSTEM_USER_EMAIL));
  if (!user) {
    [user] = await db
      .insert(t.users)
      .values({ email: SYSTEM_USER_EMAIL, name: 'You' })
      .returning();
  }
  const userId = user!.id;

  await db
    .insert(t.workspaceMembers)
    .values({ workspaceId, userId, role: 'owner' })
    .onConflictDoNothing();

  // ---- default settings ----
  const defaultSettings: Record<string, unknown> = {
    polling_interval_min: 5,
    theme: 'dark',
    density: 'regular',
    sync_to_folder: true,
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db
      .insert(t.settings)
      .values({ workspaceId, userId, key, value })
      .onConflictDoNothing();
  }

  // ---- demo repo (acme/payments-api) ----
  let [repo] = await db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, 'acme/payments-api')));
  if (!repo) {
    [repo] = await db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name: 'payments-api',
        fullName: 'acme/payments-api',
        defaultBranch: 'main',
        clonePath: null,
        createdBy: userId,
      })
      .returning();
  }
  const repoId = repo!.id;

  // ---- PR #482 (rate limiting) ----
  let [pr] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 482)));
  if (!pr) {
    [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 482,
        title: 'Add rate limiting to public API endpoints',
        author: 'marisa.koch',
        branch: 'feat/rate-limit-public',
        base: 'main',
        headSha: 'a1b2c3d4e5f6',
        additions: 247,
        deletions: 38,
        filesCount: 9,
        status: 'needs_review',
        body: 'Add rate limiting to public API endpoints to prevent abuse from unauthenticated clients.',
      })
      .returning();

    // pr_files (subset)
    await db.insert(t.prFiles).values([
      { prId: pr!.id, path: 'src/middleware/ratelimit.ts', additions: 84, deletions: 0 },
      { prId: pr!.id, path: 'src/api/public/webhooks.ts', additions: 31, deletions: 6 },
      { prId: pr!.id, path: 'src/config.ts', additions: 4, deletions: 0 },
      { prId: pr!.id, path: 'src/api/users.ts', additions: 7, deletions: 2 },
    ]);

    // pr_commits
    await db.insert(t.prCommits).values({
      prId: pr!.id,
      sha: 'a1b2c3d4e5f6',
      message: 'Add token-bucket rate limiter',
      author: 'marisa.koch',
    });

    // a sample review + findings so the PR shows results before the first run
    const [review] = await db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: pr!.id,
        kind: 'review',
        verdict: 'request_changes',
        summary:
          'Solid middleware approach, but a Stripe secret key is committed in plaintext and the user-list endpoint introduces an N+1 query under the new limiter.',
        score: 61,
        model: 'seed',
      })
      .returning();

    await db.insert(t.findings).values([
      {
        reviewId: review!.id,
        file: 'src/config.ts',
        startLine: 12,
        endLine: 12,
        severity: 'CRITICAL',
        category: 'security',
        title: 'Hardcoded Stripe secret key in commit',
        rationale: 'Line 12 contains a literal `sk_live_` Stripe secret key.',
        suggestion: 'Move to env var and rotate the key immediately.',
        confidence: 0.98,
      },
      {
        reviewId: review!.id,
        file: 'src/api/users.ts',
        startLine: 45,
        endLine: 52,
        severity: 'WARNING',
        category: 'perf',
        title: 'N+1 query in user list endpoint',
        rationale: 'Loop issues one query per user → N+1.',
        suggestion: 'Use a single IN query and group in memory.',
        confidence: 0.86,
      },
    ]);
  }

  // ---- PR #483 (skills control-experiment fixture, real patches) ----
  const [fixturePr] = await db
    .select()
    .from(t.pullRequests)
    .where(
      and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, REFUND_FIXTURE.number)),
    );
  if (!fixturePr) {
    const files = REFUND_FIXTURE.files.map((f) => ({ ...f, ...patchStats(f.patch) }));
    const [created] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: REFUND_FIXTURE.number,
        title: REFUND_FIXTURE.title,
        author: REFUND_FIXTURE.author,
        branch: REFUND_FIXTURE.branch,
        base: 'main',
        headSha: REFUND_FIXTURE.headSha,
        additions: files.reduce((n, f) => n + f.additions, 0),
        deletions: files.reduce((n, f) => n + f.deletions, 0),
        filesCount: files.length,
        status: 'needs_review',
        body: REFUND_FIXTURE.body,
      })
      .returning();
    await db.insert(t.prFiles).values(
      files.map((f) => ({
        prId: created!.id,
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      })),
    );
    await db.insert(t.prCommits).values(
      REFUND_FIXTURE.commits.map((c) => ({
        prId: created!.id,
        sha: c.sha,
        message: c.message,
        author: REFUND_FIXTURE.author,
      })),
    );
  }

  // ---- built-in agents (the three starter presets + Test Quality Reviewer) ----
  // Prompt bodies live in ./seed-prompts.ts (mirrored in docs/agent-prompts/*.md).
  const seedAgents: Array<typeof t.agents.$inferInsert> = [
    {
      workspaceId,
      name: 'General Reviewer',
      description: 'Reviews a PR diff for bugs, correctness, and clarity.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: GENERAL_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Security Reviewer',
      description: 'Flags secrets, injection, SSRF and the lethal trifecta before merge.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: SECURITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Performance Reviewer',
      description: 'Catches N+1 queries, missing indexes, and hot-path allocations.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: PERFORMANCE_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: TEST_QUALITY_AGENT_NAME,
      description:
        'Checks that tests cover new branches and corner cases, without over-mocking or flakiness.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: TEST_QUALITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
  ];
  const agentIds = new Map<string, string>();
  for (const a of seedAgents) {
    let [existing] = await db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, a.name)));
    if (!existing) [existing] = await db.insert(t.agents).values(a).returning();
    agentIds.set(a.name, existing!.id);
  }

  // ---- seeded skills (manual, v1) linked in order to Test Quality Reviewer ----
  const testQualityAgentId = agentIds.get(TEST_QUALITY_AGENT_NAME)!;
  for (const [order, s] of SEED_SKILLS.entries()) {
    let [skill] = await db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, s.name)));
    if (!skill) {
      [skill] = await db
        .insert(t.skills)
        .values({ workspaceId, ...s, source: 'manual', enabled: true, version: 1 })
        .returning();
      await db
        .insert(t.skillVersions)
        .values({ skillId: skill!.id, version: 1, ...s, message: 'Seeded' })
        .onConflictDoNothing();
    }
    // Insert-only: dev.sh re-seeds on every start, so never clobber the user's
    // order / enabled choices for an existing link.
    await db
      .insert(t.agentSkills)
      .values({ agentId: testQualityAgentId, skillId: skill!.id, order, enabled: true })
      .onConflictDoNothing();
  }

  return { workspaceId, userId };
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const handle = createDb(url);
  seed(handle.db)
    .then(async (r) => {
      console.log('✓ seeded', r);
      await handle.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('✗ seed failed:', err);
      await handle.close();
      process.exit(1);
    });
}
