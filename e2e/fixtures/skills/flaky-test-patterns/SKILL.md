---
name: flaky-test-patterns
description: Apply when the diff adds or changes tests that touch timers, dates, async work, the network, shared state, or random values. Flag every pattern that can make the test pass or fail without a code change, and name the deterministic replacement.
type: custom
---

# Flaky test patterns

A test is flaky when its result can change without a code change. Look for these
patterns in tests added or changed by the diff.

## 1. Sleeps and arbitrary waits
- `setTimeout` / `await sleep(500)` / `waitForTimeout` used to "let things settle".
- Fix: await the actual condition or promise; use `vi.useFakeTimers()` and
  `vi.advanceTimersByTime` for timer logic; poll with a bounded `waitFor`.

## 2. Real time
- `Date.now()`, `new Date()`, or `performance.now()` read by the code under test
  without control, assertions on "today", or tests that break at midnight, month
  end, or a DST change.
- Fix: `vi.setSystemTime(...)` or inject a clock.

## 3. Real network and external services
- Calls to real HTTP endpoints, DNS, or third-party sandboxes from unit tests.
- Fix: a local fake server or an owned adapter double; keep real-service checks in
  a separate, explicitly marked suite.

## 4. Order dependence and shared state
- Module-level variables, singletons, a shared DB row, env vars, or mocks that one
  test mutates and the next relies on; `it.only` / `describe.only` left in.
- Fix: reset state in `beforeEach` / `afterEach` (`vi.restoreAllMocks`,
  `vi.unstubAllEnvs`), give each test its own data, never rely on file or test order.

## 5. Unseeded randomness
- `Math.random()`, `crypto.randomUUID()`, faker, or property-based tests without a
  fixed seed, where the generated value affects the assertion.
- Fix: a fixed seed, an injected generator, or explicit values for the cases that
  matter.

## 6. Unordered results
- Asserting array order on results from `Promise.all` races, `Set` / `Map` built from
  async work, or SQL without `ORDER BY`.
- Fix: sort before comparing, or assert with `expect.arrayContaining`.

## Reporting
- Cite the test line with the flaky construct. Rationale: what makes the result
  vary. Suggestion: the deterministic replacement.
- Severity: WARNING; SUGGESTION when the risk is theoretical.
