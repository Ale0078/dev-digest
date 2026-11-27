/** Caps for the intent layer's inputs. Everything below is enforced by code, not by the prompt. */

/** PR body chars sent to the classifier. */
export const MAX_BODY_CHARS = 4000;
/** Linked issues fetched per detection, and chars of each body. */
export const MAX_ISSUES = 3;
export const MAX_ISSUE_CHARS = 3000;
/** Same-repo spec/plan files read from the clone, and chars of each. */
export const MAX_DOCS = 3;
export const MAX_DOC_CHARS = 6000;
/** External URLs fetched per detection, and chars of each (the fetcher enforces the char cap). */
export const MAX_EXTERNAL_LINKS = 3;
export const MAX_EXTERNAL_CHARS = 6000;
/** Ticket keys / URLs recorded as `unavailable` signals. */
export const MAX_TICKETS = 3;
/** Total chars across issue + spec + external sources; trimmed by that priority. */
export const MAX_SOURCES_CHARS = 16_000;

/** Output caps applied by `normalizeIntent` (the model's strings are untrusted). */
export const MAX_SUMMARY_CHARS = 600;
export const MAX_ITEM_CHARS = 200;
export const MAX_RISK_CHARS = 80;
export const MAX_MISSING_CONTEXT = 6;

/** Upper-case prefixes that look like ticket keys but are not (`UTF-8`, `SHA-256`, `CVE-2024`). */
export const TICKET_FALSE_PREFIXES = new Set([
  'UTF', 'SHA', 'ISO', 'RFC', 'CVE', 'AES', 'RSA', 'TLS', 'MD', 'HTTP', 'ES', 'X', 'IPV', 'PDF',
]);
