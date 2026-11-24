# Fastify in the onion

Fastify is the outermost ring: a delivery mechanism. Business logic must not know it exists.

## Route = thin adapter
A route does four things: validate (Zod via `fastify-type-provider-zod`), resolve tenancy (`getContext`),
call one service method, return a DTO.

```ts
// modules/widgets/routes.ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { Widget } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';

export default async function widgets(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const service = app.container.widgetsService; // built in the composition root

  r.get('/widgets/:id', { schema: { params: IdParams, response: { 200: Widget } } }, async (req) => {
    const ctx = await getContext(app.container, req);
    return service.get(ctx.workspaceId, req.params.id); // throws NotFoundError → global handler
  });
}
```

`app.container` is decorated in `app.ts` (`app.decorate('container', container)`). Existing routes do
`new AgentsService(app.container)`, which is legacy. New code builds the service with explicit dependencies,
either as a `Container` getter or in the plugin: `new WidgetsService(app.container.widgetsRepo, …)`.

## Rules
- Throw `AppError` subclasses from services. `app.setErrorHandler` in `app.ts` turns them into the
  `{ error: { code, message, details } }` envelope. Routes don't `try/catch` to rewrite domain errors.
- Never pass `req`/`reply`/`FastifyInstance` into a service. Pass plain values (`workspaceId`, parsed body).
- Response schemas are part of the HTTP contract and also prevent leaking DB columns.
- Hooks (`onRequest`, `preHandler`) are for cross-cutting HTTP concerns (auth, local-only guard), not business rules.
- Register modules statically in `modules/index.ts` (see the comment there — no autoload).

## Plugins and decorators as DI (background)
- `register` creates an encapsulated scope; `decorate` on a child doesn't leak to parents unless wrapped with
  `fastify-plugin`. `decorate(name, value, deps)` checks deps at boot.
- In this repo the DI mechanism is `platform/container.ts`, not decorators. Don't introduce a second DI
  system (Awilix, decorator-based services) — extend `Container` instead.

Sources: Fastify Plugins, Fastify Decorators, marcoturi/fastify-boilerplate (see `../references.md`).
