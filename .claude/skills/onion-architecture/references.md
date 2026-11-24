# References

All links checked on 2026-11-24.

## Onion Architecture and related styles
- Jeffrey Palermo — [The Onion Architecture: part 1](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/).
  The original post: dependencies point only toward the center; "The database is not the center. It is external."
- Jeffrey Palermo — [The Onion Architecture: part 2](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/).
  A controller depends only on core interfaces, and an IoC container injects the implementations.
- Jeffrey Palermo — [Onion architecture tag (incl. part 4, "After Four Years")](https://jeffreypalermo.com/tag/onion-architecture).
  The four tenets. An IoC container is not one of them.
- Herberto Graça — [Onion Architecture](https://herbertograca.com/2017/09/21/onion-architecture/).
  Onion as Ports & Adapters with domain layers added inside.
- Allegro Tech — [Onion Architecture](https://blog.allegro.tech/2023/02/onion-architecture.html).
  Three layers. The application layer owns use cases and transaction boundaries through an interface.
- NDepend — [Onion Architecture: Going Beyond Layers](https://blog.ndepend.com/onion-architecture-layers/).
  Keeps the ORM out of the domain and translates DB errors in repositories.
- Robert C. Martin — [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html).
  The Dependency Rule. Data crosses boundaries as simple structures, not DB rows.
- Alistair Cockburn — [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/).
  Primary and secondary ports with swappable adapters; tests use mock adapters.

## Fastify
- [Fastify — Plugins](https://fastify.dev/docs/latest/Reference/Plugins/): encapsulation, `fastify-plugin`.
- [Fastify — Decorators](https://fastify.dev/docs/latest/Reference/Decorators/): `decorate` and boot-time dependency checks.
- [marcoturi/fastify-boilerplate](https://github.com/marcoturi/fastify-boilerplate): Fastify 5 with clean, hexagonal and onion
  architecture. Flow is Route → Handler → Service → Domain + Repository port, and dependency-cruiser checks the boundaries.

## Drizzle / repository pattern
- [Drizzle ORM — Transactions](https://orm.drizzle.team/docs/transactions): `db.transaction(async (tx) => …)` and savepoints.
- [Folionaut ADR-004: Repository Pattern](https://spencerjireh.github.io/folionaut/decisions/004-repository-pattern):
  a repository over Drizzle. Its advice: "Don't over-abstract, only what's needed."
- LogRocket — [Exploring the repository pattern with TypeScript and Node](https://blog.logrocket.com/exploring-repository-pattern-typescript-node).

## Zod / boundaries
- Alexis King — [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/).

## Enforcing boundaries (future work, not used by this skill yet)
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser): already a dependency in `server/package.json`.
  It supports `forbidden` rules with `from`/`to` path filters.
- lastminute.com — [How we enforce architecture boundaries at scale](https://technology.lastminute.com/how-we-enforce-architecture-boundaries-at-scale-on-our-app/).
  Module-by-module migration, recommended over a big-bang change.
- Remo Jansen — [Enforce Clean Architecture with fresh-onion](https://dev.to/remojansen/enforce-clean-architecture-in-your-typescript-projects-with-fresh-onion-45pi).
