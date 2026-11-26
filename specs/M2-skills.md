# M2 · Skills in the product
Status: draft
Modules: server, client, reviewer-core, e2e, `.claude/skills`

## Goal
A skill is a reusable piece of agent configuration: name, description, type, and a markdown body. A skill is text
only. It has no tools, no scripts, and it never executes. When an agent is linked to a skill and the skill is
enabled, the skill becomes its own block in that agent's prompt.

Users can:
- create, edit, version, restore, import, and enable/disable skills;
- link skills to agents, enable/disable them per agent, and set their order;
- see in the run trace which skills went into the prompt and how many tokens they added.

## Non-goals
- Evals tab and the **Run on evals** button. The design shows them, but they are not built in this milestone (see
  Open questions).
- Import from a URL and the community catalog. The old strings for these in `messages/en/skills.json` are removed.
- Executing or unpacking anything from an imported archive except the skill text.
- Model-chosen skills. An enabled skill is always injected.
- Bumping an agent's version when its skill links or their order change. `agent_versions` is left alone.

## What already exists (reuse, don't rebuild)
- Tables: `skills`, `skill_versions`, `agent_skills(agent_id, skill_id, order)`.
- Repository methods: `AgentsRepository.linkedSkills / linkSkill / unlinkSkill / setSkills`.
- Routes: `GET/POST /agents/:id/skills`.
- Contracts: `Skill`, `SkillType`, `SkillSource`, `AgentSkillLink` in `contracts/knowledge.ts`, and
  `PromptAssembly.skills` in `contracts/trace.ts`.
- reviewer-core: `ReviewInput.skills: string[]` → `assemblePrompt` already builds a skills block into
  `assembly.skills`.
- The trace drawer (`TraceBody`) already renders `prompt_assembly.skills` as its own `PromptBlock`.
- Client: `react-markdown` + `remark-gfm`, `@devdigest/ui` `Donut`, and the `skills.json` / `agents.json → skills`
  message namespaces.

The missing piece in the run path: `run-executor.ts` never passes `skills` to `reviewPullRequest`.

## Design

### Semantics
- **Effective skill**: the skill goes into an agent's prompt iff `skills.enabled && agent_skills.enabled`, in
  `agent_skills.order` ascending.
- **Global toggle** (on the skill card and in Config): turns the skill off in every agent. In an agent's Skills tab,
  a skill that is globally off shows greyed out, with the hint "disabled globally".
- **Agent Skills tab**:
  - It lists **every** workspace skill. Linked skills come first, in their order; unlinked skills follow,
    unchecked.
  - Checkbox = `agent_skills.enabled`. Drag sets the order.
  - Save persists every row as a link with its order and enabled flag. Because of this, a disabled skill keeps its
    position.
  - Links are only removed when the skill is deleted (cascade).
- **Imported skills** are saved with `enabled = false` and `source = 'imported'`. The UI shows the "Imported" badge
  and a trust banner: an imported skill is someone else's instructions inside the agent prompt.
- **Versioning**: a save that changes name, description, type, or body bumps `skills.version` and writes a full
  snapshot row to `skill_versions`. Toggling `enabled` does not create a version. A save with only a change
  note (no content change) writes that note as the message of the current version; no new version.
- **Restore vN**: creates a *new* version with vN's content, so history is never rewritten.

### Data (one new migration `0011_*`; SQL shown and approved before applying)
- `agent_skills.enabled boolean NOT NULL DEFAULT true`
- `skill_versions`:
  - add `name text`, `description text`, `type text`, `message text`;
  - all four are nullable, because rows written before this milestone lack them;
  - `body` is already there.
- `run_skills(run_id uuid → agent_runs ON DELETE CASCADE, skill_id uuid → skills ON DELETE CASCADE,
  skill_version int, PK(run_id, skill_id))`:
  - one row per skill actually injected into a run;
  - it is the source for Stats, and saves scanning `run_traces` jsonb.
- `SkillSource`:
  - add `'imported'` (the TS enum only; the column is `text`, so no migration);
  - `imported_url` and `community` stay valid for old rows;
  - change it in **both** contract copies.

### Contracts (server + client copies, then typecheck all packages)
- `Skill`:
  - add `agent_count: number` (enabled links), `body_tokens: number`, `updated_at`;
  - add `stats` summary `{ pull_rate: number|null, accept_rate: number|null }` for the card footer.
- `SkillVersion`: `{ skill_id, version, name?, description?, type?, body, message?, created_at }`.
- `SkillStats`:
  - `{ used_by, pull_rate, accept_rate, findings_30d, agents: [{id, name}], by_category: [{category, count}] }`;
  - the design's donut legend shows `$` amounts; the real values are finding **counts**.
- `SkillImportPreview`: `{ name, description, type, body, ignored_files: string[], warnings: string[] }`.
- `AgentSkillLink`: add `enabled: boolean`.
- `PromptAssembly`: add `skills_tokens: number | nullish`.
- `RunTrace.config`: add `skills: [{ id, name, version }] | nullish`.
- New trace fields are `.nullish()` and normalised to `null` on read: old traces lack them (see
  `server/INSIGHTS.md`).

### Server: new module `src/modules/skills/` (routes · service · repository, onion layering)
| Method | Path | Notes |
|---|---|---|
| GET | `/skills` | workspace list + `agent_count` + card stats |
| GET | `/skills/:id` | one skill |
| POST | `/skills` | create (manual, or confirm import) → v1 + `skill_versions` row |
| PUT | `/skills/:id` | edit (optional `message`) or toggle `enabled` |
| DELETE | `/skills/:id` | links cascade; the client confirms and lists the affected agents first |
| GET | `/skills/:id/versions` | newest first |
| POST | `/skills/:id/versions/:version/restore` | new version from vN, message "Restored vN" |
| GET | `/skills/:id/stats` | Stats tab (30-day window) |
| POST | `/skills/token-count` | `{ text }` → `{ tokens }`; same `container.tokenizer` as the trace (live editor count) |
| POST | `/skills/import/preview` | multipart `.md` or `.zip` → `SkillImportPreview`; **writes nothing** |

- **Import parsing** is a pure helper with no I/O, unit-tested.
  - `.md`:
    - YAML frontmatter `name` / `description` (optional `type`, otherwise `custom`) plus the body;
    - with no frontmatter: name = the first `# heading` slugified, description = empty, and a warning is added.
  - `.zip`:
    - read in memory, never written to disk;
    - take `SKILL.md` from the root or one level deep;
    - every other entry goes into `ignored_files`, including `scripts/`, binaries, and `references/`;
    - a zip without `SKILL.md` → 422.
  - Limits:
    - upload ≤ 1 MB, ≤ 200 entries, ≤ 5 MB uncompressed in total;
    - reject entries with `..` or an absolute path;
    - reject a `SKILL.md` over 64 KB.
  - Any other file extension → 415.
  - New deps: a zip reader (`fflate`), `yaml`, and `@fastify/multipart` if it's not already present.
- **Agents module**:
  - Extend `POST /agents/:id/skills` with an `items: [{ skill_id, enabled }]` variant (ordered). Keep `skill_ids`
    for compatibility.
  - `GET /agents/:id/skills` returns `enabled`.
  - `setSkills` / `linkSkill` must verify that every `skill_id` belongs to the agent's workspace. Today they don't:
    a skill can be linked across tenants.
- **Stats definitions** (30 days, local + ci runs):
  - `used_by`: agents with an enabled link.
  - `pull_rate`: runs with a `run_skills` row for the skill ÷ done runs of agents currently linked to it (any link
    state).
  - `accept_rate`: accepted ÷ (accepted + dismissed) findings of runs that included the skill; `null` when the
    denominator is 0.
  - `findings_30d` and `by_category`: findings of runs that included the skill.
  - Attribution is correlational: a run having the skill doesn't mean the skill caused the finding. The UI shows
    this as a tooltip.

### Run path (reviewer-core + run-executor)
- `run-executor.runOneAgent`:
  1. loads the effective skills through `agentsRepo` (a new `effectiveSkills(agentId)` that joins `skills.enabled`
     and link `enabled`);
  2. renders each one with `renderSkillBlock`;
  3. passes the result as `skills`.
- `renderSkillBlock(skill)` lives in reviewer-core and is shared with the CI runner:
  `### <name>\n<description>\n\n<body>`. The skill Preview tab renders this exact string, so it shows "as the
  reviewing agent receives it".
- **Prompt placement**: move the skills block from the user message into the **system** message, right after the
  agent's system prompt and before `INJECTION_GUARD`, as `## Skills`. This matches the Config hint "Skills are
  appended below it". Skills are trusted instructions by design, so they are not `<untrusted>`-wrapped. The
  imported → disabled → manual enable flow is the trust gate.
- Logging and persistence:
  - the Live Log gets `skills: N attached (name vX, …) · K tok`;
  - persist `run_skills` rows;
  - the trace gets `prompt_assembly.skills_tokens` and `config.skills`.
- In map-reduce mode the skills block is sent with **every** chunk. The trace shows
  `skills_tokens × chunks` next to the block.
- With no effective skills the prompt is byte-identical to today's, apart from the moved section, which then
  doesn't appear at all.

### Client
- **Navigation**:
  - add a `SKILLS LAB` sidebar group with **Skills** (`/skills`, `g s`) above **Agents**, which moves into this
    group;
  - Conventions and Eval Dashboard from the design are not added (they don't exist yet);
  - `nav.ts` lives in `src/vendor/ui` (see Open questions).
- **`/skills`** has a master–detail layout like `/agents`:
  - **Left: the list.**
    - Search box.
    - **Add Skill** menu with *Create skill* and *Import from file*.
    - Each card shows: name; enabled toggle; truncated description; type badge; source badge (Manual / Extracted /
      Community / Imported); a footer `N agents · X% pull · Y% accept`, which shows `—` when there's no data.
  - **Right: the detail.**
    - Header: skill name, type badge, `vN` badge.
    - Tabs, kept in `?tab=`:
      - **Config**:
        - fields Name\*, Description, Type, Skill body\*, and the Enabled toggle;
        - Description hint: "Write it as a directive: when the agent should apply this skill and what it must do";
        - the body editor is a textarea with a line-number gutter (no new editor dependency);
        - the body editor header shows the filename `<name>.md`, an `unsaved` badge when dirty, and a live token
          count (debounced `POST /skills/token-count`);
        - Save takes an optional "change note", which becomes the version message.
      - **Preview**: `renderSkillBlock` output rendered with `react-markdown` + `remark-gfm`.
      - **Stats**:
        - tiles: Used by, Pull frequency, Accept rate (ring), Findings (30d);
        - an "Agents using this skill" list, with **Open** → `/agents/:id?tab=skills`;
        - a "Findings by category" donut of counts.
      - **Versions**:
        - list of `vN · message · date`;
        - **Current** badge on the latest;
        - **Diff** shows a line diff of that version against the current one;
        - **Restore** asks for confirmation, then creates a new version.
- **Import drawer**:
  - drop or pick a `.md` / `.zip`;
  - the preview has editable name, description, type, and body;
  - the `ignored_files` list says "not imported, never executed";
  - plus warnings and the trust banner;
  - **Save** creates the skill, disabled; **Cancel** discards it, and nothing was persisted.
- **Agent editor → Skills tab** (matching the earlier design):
  - `N of M enabled` counter;
  - filter box;
  - drag handle, checkbox, name, type badge;
  - Save.
  - Add `skills` to `AgentEditor/constants.ts → TABS`.
- **Agent card**: `N skills` counts enabled links.
- **Trace drawer**: the Skills `PromptBlock` header shows `+K tok` from `skills_tokens`, and lists the skill names
  and versions from `config.skills`.
- **Data layer**: hooks in `src/lib/hooks/skills.ts`, API calls in `src/lib/api.ts`.
- **Strings**: all go in `messages/en/skills.json` (replacing the old URL/community keys) and `agents.json`.

### Seed: new agent + skills
- **Test Quality Reviewer**:
  - checks for uncovered branches, missing corner cases, over-mocking, and flaky tests;
  - prompt in `docs/agent-prompts/test-quality-reviewer.md` + `seed-prompts.ts` + `seed.ts`.
- **Seeded skills** (each with a v1 `skill_versions` row), linked to it in this order:
  1. `branch-coverage-gate` (rubric): every new branch or early return needs an asserting test.
  2. `corner-case-checklist` (rubric): empty, null, boundary, overflow, unicode, concurrency, time zones.
  3. `mocking-smells` (convention): mocking the unit under test, asserting on mocks only, mocking what you don't
     own.
- **Imported skill**: `flaky-test-patterns` (custom; covers sleeps, real time/network, order dependence, unseeded
  randomness).
  - It ships as `e2e/fixtures/skills/flaky-test-patterns.zip`, which contains `SKILL.md` plus a dummy
    `scripts/run.sh` to prove that it is ignored.
  - It is imported through the UI, enabled, and linked: this is the full import path.
- **Control-experiment fixture**: a PR whose code adds a branch and a boundary but whose test covers only the happy
  path.

### Dev tooling
- Add `disable-model-invocation: true` to the frontmatter of `.claude/skills/pr-self-review/SKILL.md`.
- Update root `CLAUDE.md`: today it tells the agent to run the skill itself before a PR. After this change, it
  tells the agent to ask the user to run `/pr-self-review`. The gate hook is unchanged.

## Implementation phases
1. Contracts (both copies) and migration `0011`: generate it, show the SQL, **wait for approval**.
2. Server `skills` module (CRUD, versions, restore, token-count, import preview, stats), the agents link changes,
   the workspace check, and `*.it.test.ts` + unit tests for the import parser.
3. reviewer-core `renderSkillBlock` + system-message placement + tests; run-executor wiring, `run_skills`, and the
   trace fields.
4. Client: nav, `/skills` (list, Config, Preview, Stats, Versions), import drawer, agent Skills tab, trace drawer.
   Component tests.
5. Seed (agent + 3 skills + fixture PR), the import zip fixture, and the e2e flow: create, edit, import preview,
   link, toggle.
6. `pr-self-review` frontmatter + `CLAUDE.md`.
7. Manual control experiment with a real LLM, then `/pr-self-review` before the PR.

## Acceptance criteria
- [ ] A skill can be created and edited in the UI; each content save creates a version with a note; Restore creates a
      new version.
- [ ] Toggling a skill globally removes it from every agent's prompt; toggling it in an agent removes it only there.
- [ ] Order in the agent Skills tab equals the order of skill blocks in the assembled prompt.
- [ ] Import of `.md` and `.zip` goes through a preview; nothing is stored before Save; `scripts/` and other files are
      listed as ignored and never unpacked or run; an imported skill starts disabled.
- [ ] Test Quality Reviewer has 4 linked skills (3 seeded + 1 imported).
- [ ] An enabled skill appears in the run trace as its own block with its token count; a disabled skill does not.
- [ ] Control experiment: on the happy-path-only PR, Test Quality Reviewer without skills misses the uncovered
      branch; with skills it flags the uncovered branch and the boundary case.
- [ ] Stats and the card footer show real numbers from `run_skills`, or `—` when empty.
- [ ] Old traces without the new fields still load.
- [ ] Contracts are identical in the server and client copies; typecheck passes in all packages.
- [ ] `pr-self-review` is not auto-invoked; run manually, it routes both client (UI) and server (backend) skills.

## Open questions
- `nav.ts` is in `client/src/vendor/ui`, which `client/CLAUDE.md` marks do-not-touch. Allow editing it for this
  milestone, or add the item from the app-shell side?
- Evals tab / **Run on evals**: hide them, or render them disabled with "coming soon"?
- The API Contract control experiment from the original requirements is dropped (one new agent only). Confirm.
