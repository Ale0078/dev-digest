# Poll interval parsing

`parsePollInterval` (`src/modules/polling/interval.ts`, re-exported from the polling barrel) turns a
human-friendly duration into milliseconds for PR-list auto-polling. Parsing is done by the
[`ms`](https://github.com/vercel/ms) package.

| Input | Result |
|---|---|
| `"5m"`, `"1h"`, `" 2m "` | parsed value (whitespace trimmed) |
| below 1 minute, e.g. `"10s"` | clamped up to `MIN_POLL_INTERVAL_MS` (60 000) |
| `undefined`, `null`, `""`, unparseable (`"soon"`) | `DEFAULT_POLL_INTERVAL_MS` (5 minutes) |

The lower bound keeps a misconfigured interval from hammering the GitHub API. There is no upper bound.

Tests: `test/polling-interval.test.ts`.
