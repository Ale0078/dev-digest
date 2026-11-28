import ms from 'ms';

/** Lower bound for the auto-poll interval, so GitHub isn't hammered. */
export const MIN_POLL_INTERVAL_MS = 60_000;

/** Default auto-poll interval when nothing (or nothing valid) is configured. */
export const DEFAULT_POLL_INTERVAL_MS = 5 * 60_000;

/**
 * Parse a human-friendly poll interval ("30s", "5m", "1h") into milliseconds.
 * Invalid or empty input falls back to the default; values below the minimum
 * are clamped up to it.
 */
export function parsePollInterval(input: string | undefined | null): number {
  if (!input) return DEFAULT_POLL_INTERVAL_MS;
  const parsed = ms(input.trim());
  if (typeof parsed !== 'number' || Number.isNaN(parsed)) return DEFAULT_POLL_INTERVAL_MS;
  return Math.max(parsed, MIN_POLL_INTERVAL_MS);
}
