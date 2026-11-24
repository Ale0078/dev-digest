# Drizzle in the onion

"The database is not the center. It is external." (Palermo). Drizzle is an infrastructure detail behind a port.

## Port in, Drizzle out

```ts
// modules/widgets/types.ts — port (inner ring)
import type { Widget } from '@devdigest/shared';
export interface WidgetsStore {
  getById(workspaceId: string, id: string): Promise<Widget | undefined>;
  insert(workspaceId: string, input: { name: string }): Promise<Widget>;
}

// modules/widgets/repository.ts — adapter (outer ring)
import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { WidgetsStore } from './types.js';
import { toWidgetDto } from './helpers.js';

export class WidgetsRepository implements WidgetsStore {
  constructor(private db: Db) {}
  async getById(workspaceId: string, id: string) {
    const [row] = await this.db.select().from(t.widgets)
      .where(and(eq(t.widgets.workspaceId, workspaceId), eq(t.widgets.id, id)));
    return row ? toWidgetDto(row) : undefined; // Row never leaves this file
  }
  // …
}
```

## Rules
- `drizzle-orm`, `db/schema`, `db/client`, `db/rows` are imported only from repositories, `db/**`, and `container.ts`.
- Every query is workspace-scoped (`workspaceId` in the `where`) — the repository enforces it.
- Map at the boundary: `Row → DTO` in the repository (or a mapper it calls). Services and routes see DTO/domain types.
- Keep ports narrow: methods the use case needs, not a generic `Repository<T>` with everything ("don't over-abstract").
- Translate DB errors (unique violation `23505`, FK `23503`) into `AppError` subclasses inside the repository.

## Transactions
Drizzle API: `await db.transaction(async (tx) => { …; return value; })`; throw or `tx.rollback()` to abort;
nested `tx.transaction(...)` = savepoint.

- A transaction spanning one aggregate → a single repository method that opens it.
- A transaction spanning several repositories → a unit-of-work port owned by the application layer, e.g.
  `interface Tx { run<T>(fn: (repos: { agents: AgentsStore; versions: VersionsStore }) => Promise<T>): Promise<T> }`,
  implemented in infrastructure with `db.transaction` and repositories built on `tx`.
- Never call `db.transaction` in a route or service.

## Schema & migrations
Schema lives in `db/schema/**` (infrastructure). Migration rules are in `server/CLAUDE.md` (immutable, apply only
with approval). Use `drizzle-orm-patterns` and `postgresql-table-design` for query/schema details.
