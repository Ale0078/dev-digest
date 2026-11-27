import { isIP } from 'node:net';

/**
 * SSRF guard: decide whether a resolved IP address may be connected to by the
 * link fetcher. Only public, globally routable unicast addresses pass.
 * Pure (no I/O) — used by `safe-fetch.ts` for literal hosts and DNS results.
 */

function ipv4Octets(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

function isBlockedIPv4(ip: string): boolean {
  const o = ipv4Octets(ip);
  if (!o) return true;
  const [a, b, c] = o as [number, number, number, number];
  return (
    a === 0 || // "this" network, 0.0.0.0
    a === 10 || // RFC1918
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local (cloud metadata)
    (a === 172 && b >= 16 && b <= 31) || // RFC1918
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 192 && b === 168) || // RFC1918
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast, reserved, broadcast
  );
}

/** Expand an IPv6 literal to 8 16-bit groups, or null when malformed. */
function expandIPv6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone);
  // Embedded dotted IPv4 tail (::ffff:1.2.3.4) → two hex groups.
  const lastColon = s.lastIndexOf(':');
  const tail = s.slice(lastColon + 1);
  if (tail.includes('.')) {
    const o = ipv4Octets(tail);
    if (!o) return null;
    const hi = ((o[0]! << 8) | o[1]!).toString(16);
    const lo = ((o[2]! << 8) | o[3]!).toString(16);
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.every((n) => Number.isInteger(n)) ? nums : null;
}

function isBlockedIPv6(ip: string): boolean {
  const g = expandIPv6(ip);
  if (!g) return true;
  // Only global unicast 2000::/3 is allowed; this rejects ::, ::1, fc00::/7, fe80::/10,
  // ff00::/8, IPv4-mapped ::ffff:0:0/96 and NAT64 64:ff9b::/96 in one rule.
  if ((g[0]! & 0xe000) !== 0x2000) return true;
  if (g[0] === 0x2001 && (g[1] === 0 || g[1] === 0x0db8)) return true; // Teredo, documentation
  if (g[0] === 0x2002) return true; // 6to4 embeds an arbitrary IPv4
  return false;
}

/** True when the address must NOT be connected to (non-public, malformed, or not an IP). */
export function isBlockedAddress(ip: string): boolean {
  const bare = ip.startsWith('[') && ip.endsWith(']') ? ip.slice(1, -1) : ip;
  const family = isIP(bare);
  if (family === 4) return isBlockedIPv4(bare);
  if (family === 6) return isBlockedIPv6(bare);
  return true;
}
