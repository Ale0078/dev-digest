import * as t from '../../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import type { PgFixture } from './pg.js';

/**
 * `runReview` is fire-and-forget: the POST returns runIds immediately and each
 * agent's review is persisted in the background (the client subscribes to SSE).
 * Tests that assert on persisted reviews/findings/traces must first wait for the
 * background runs to finish. This polls `agent_runs` until every row for the PR
 * reaches a terminal status (done / failed / cancelled) AND has its `run_traces` row.
 * The executor sets the terminal status before it writes `run_skills` and the trace
 * (`run-executor.ts`: `completeAgentRun` → `insertRunSkills` → `saveRunTrace`), so a
 * status-only wait races those writes. Every terminal path saves a trace last.
 */
const TERMINAL = new Set(['done', 'failed', 'cancelled']);

export async function waitForPrRuns(
  db: PgFixture['handle']['db'],
  prId: string,
  opts: { expected?: number; timeoutMs?: number } = {},
): Promise<Array<typeof t.agentRuns.$inferSelect>> {
  const { expected, timeoutMs = 10_000 } = opts;
  const start = Date.now();
  for (;;) {
    const runs = await db.select().from(t.agentRuns).where(eq(t.agentRuns.prId, prId));
    const settled = runs.filter((r) => TERMINAL.has(r.status ?? ''));
    const traced = settled.length
      ? new Set(
          (
            await db
              .select({ runId: t.runTraces.runId })
              .from(t.runTraces)
              .where(inArray(t.runTraces.runId, settled.map((r) => r.id)))
          ).map((r) => r.runId),
        )
      : new Set<string>();
    const terminal = settled.filter((r) => traced.has(r.id));
    // With an explicit `expected`, wait until that many runs finish (ignores any
    // extra rows, e.g. a trifecta scan). Otherwise wait for all rows to settle.
    const done =
      expected != null
        ? terminal.length >= expected
        : runs.length > 0 && terminal.length === runs.length;
    if (done) return runs;
    if (Date.now() - start > timeoutMs) return runs;
    await new Promise((r) => setTimeout(r, 25));
  }
}
