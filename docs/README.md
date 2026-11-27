# docs — cross-module

Durable documentation of **implemented** behaviour. This file is the section map: it says where each kind of doc
goes. The `doc-writer` agent (`.claude/agents/doc-writer.md`) follows it, and so should anyone writing docs by hand.

## Section map

Pick the type with the [Diátaxis compass](https://diataxis.fr/compass/): does the reader need **action** or
**cognition**, while **learning** or while **working**?

| Where | Content | Diátaxis type | File name |
|---|---|---|---|
| `docs/architecture/` | How the modules fit together and why. C4 context/container diagrams only | explanation | `kebab-case.md` |
| `docs/features/` | One doc per implemented cross-module feature: behaviour, flow diagram, data and contracts, routes, code links | explanation + reference | `M<n>-<slug>.md` (same slug as the spec) |
| `docs/how-to/` | Developer task guides, e.g. "add a reviewer agent" | how-to | `kebab-case.md` |
| `docs/adr/` | Cross-module architecture decisions, Nygard format | decision record | `NNNN-slug.md` |
| `docs/agent-prompts/` | Canonical reviewer-agent system prompts, mirrored into the DB | reference | owned by its own README; not edited by `doc-writer` |
| `<module>/docs/` | Notes, ADRs (`adr/NNNN-slug.md`) and how-tos that concern one module only | per that module's `docs/README.md` | per that README |

A folder is created when its first doc is written. Empty folders are not kept.

## What does not go here
- `specs/`, `<module>/specs/`, `specs/plans/`: planned work, not documentation of what exists.
- `README.md` (root and module): overview and Quick start. The Quick start is the project's tutorial.
- `CLAUDE.md`, `INSIGHTS.md`: agent rules and engineering lessons.

## Rules
- Document only behaviour that exists in the code. Cite the files (`path` or `path:line`) a claim rests on.
- Diagrams are Mermaid fenced blocks (` ```mermaid `), which GitHub renders.
- ADRs use Title, Status, Context, Decision, Consequences. Numbers are never reused. An accepted ADR changes only its
  Status (e.g. "Superseded by 0007").
- Link to module READMEs instead of copying them.

## Index
- [agent-prompts/](agent-prompts/README.md): canonical reviewer-agent system prompts
