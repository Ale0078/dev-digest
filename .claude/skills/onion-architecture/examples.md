# Examples — bad → good

## 1. Query in a route

❌ Bad (pattern found in `modules/pulls/routes.ts`)
```ts
import { and, eq } from 'drizzle-orm';
import * as t from '../../db/schema.js';

r.get('/repos/:id/pulls', { schema: { params: IdParams } }, async (req) => {
  const ctx = await getContext(app.container, req);
  const rows = await app.container.db.select().from(t.pulls)
    .where(and(eq(t.pulls.workspaceId, ctx.workspaceId), eq(t.pulls.repoId, req.params.id)));
  return rows.map((r) => ({ ...r, status: deriveReviewStatus(r) })); // business rule in HTTP layer
});
```

✅ Good
```ts
// routes.ts
r.get('/repos/:id/pulls', { schema: { params: IdParams, response: { 200: z.array(PrMeta) } } }, async (req) => {
  const ctx = await getContext(app.container, req);
  return pullsService.list(ctx.workspaceId, req.params.id);
});

// service.ts
export class PullsService {
  constructor(private pulls: PullsStore) {}
  async list(workspaceId: string, repoId: string): Promise<PrMeta[]> {
    const prs = await this.pulls.listByRepo(workspaceId, repoId);
    return prs.map((pr) => ({ ...pr, status: deriveReviewStatus(pr) })); // pure domain fn
  }
}

// repository.ts implements PullsStore with Drizzle; Container wires it.
```

## 2. Service as service-locator

❌ Bad (pattern in `modules/agents/service.ts`)
```ts
export class AgentsService {
  private repo: AgentsRepository;
  constructor(private container: Container) {
    this.repo = new AgentsRepository(container.db); // concrete + DB handle in application ring
  }
}
```

✅ Good
```ts
// modules/agents/types.ts
export interface AgentsStore { list(ws: string): Promise<Agent[]>; /* … */ }

// modules/agents/service.ts
export class AgentsService {
  constructor(private agents: AgentsStore, private llm: (id: Provider) => Promise<LLMProvider>) {}
}

// platform/container.ts
get agentsService(): AgentsService {
  return (this._agentsService ??= new AgentsService(this.agentsRepo, (id) => this.llm(id)));
}
```

## 3. New external system

✅ Good — adding a "Slack notifier"
1. `vendor/shared/adapters.ts`: `export interface Notifier { send(channel: string, text: string): Promise<void> }`
   (mirror in `client/src/vendor/shared`, typecheck all packages) — or `modules/notify/types.ts` if server-only.
2. `adapters/notifier/slack.ts`: `export class SlackNotifier implements Notifier { … }`
3. `adapters/mocks.ts`: `export class MockNotifier implements Notifier { sent: … }`
4. `platform/container.ts`: `notifier?: Notifier` in `ContainerOverrides`; lazy getter reading the token via
   `this.secrets.get('SLACK_TOKEN')`, throwing `ConfigError` if missing.
5. Service receives `Notifier` in its constructor; test uses `MockNotifier`.

## 4. Leaking rows

❌ `async get(): Promise<AgentRow>` in a service, or `import type { AgentRow } from '../../db/rows.js'` in a route.
✅ Repository returns `Agent` (contract type) via `toAgentDto(row)`; `AgentRow` stays inside infrastructure.

## 5. Transaction in the wrong ring

❌ `await app.container.db.transaction(async (tx) => { … })` inside a route or service.
✅ `agentsRepo.updateWithVersion(ws, id, patch)` opens the transaction internally, or a unit-of-work port
(see `references/drizzle.md`).
