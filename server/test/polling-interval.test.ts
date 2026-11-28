import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POLL_INTERVAL_MS,
  MIN_POLL_INTERVAL_MS,
  parsePollInterval,
} from '../src/modules/polling/interval.js';

describe('parsePollInterval', () => {
  it.each([
    ['5m', 5 * 60_000],
    ['1h', 60 * 60_000],
    [' 2m ', 2 * 60_000],
  ])('parses %j', (input, expected) => {
    expect(parsePollInterval(input)).toBe(expected);
  });

  it('clamps values below the minimum', () => {
    expect(parsePollInterval('10s')).toBe(MIN_POLL_INTERVAL_MS);
  });

  it.each([undefined, null, '', 'soon'])('falls back to the default for %j', (input) => {
    expect(parsePollInterval(input)).toBe(DEFAULT_POLL_INTERVAL_MS);
  });
});
