# Zod at the boundaries

## Two kinds of schemas
| Kind | Where | Ring |
|---|---|---|
| Contracts (`Agent`, `Review`, `RunTrace`, …) | `vendor/shared/contracts/*` | Domain — shared with the client, no DB/HTTP specifics |
| Transport schemas (`IdParams`, `CreateAgentBody`, query params) | `modules/<name>/routes.ts`, `modules/_shared/schemas.ts` | HTTP entry |

## Rules
- **Parse, don't validate:** parse untrusted input once at the edge into a precise type, then pass that type
  inward. Services accept typed input and don't re-parse it.
- Route input goes through the route's `schema` (`fastify-type-provider-zod`) — never `Schema.parse(req.body)` by hand.
- External data that isn't HTTP (LLM output, GitHub payloads, jsonb read from the DB) is parsed in the adapter or
  repository that receives it, before it reaches the service.
- jsonb columns: old rows may lack new fields — make them `.nullish()` and normalise at read time (server `INSIGHTS.md`).
- A contract change touches both copies (`server/src/vendor/shared` and `client/src/vendor/shared`) — root `CLAUDE.md`.
- Use `z.infer<typeof X>` for types; don't hand-write parallel interfaces.

See the `zod` skill for API details. Source: Alexis King, "Parse, don't validate" (`../references.md`).
