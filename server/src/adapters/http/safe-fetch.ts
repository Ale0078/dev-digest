import http from 'node:http';
import https from 'node:https';
import { lookup as dnsLookup } from 'node:dns';
import { isIP } from 'node:net';
import type { FetchedLink, LinkFetcher } from '../../modules/intent/types.js';
import { isBlockedAddress } from './ip-guard.js';

/**
 * SafeLinkFetcher — fetches an author-supplied external URL for the intent layer.
 *
 * The URL is attacker-controlled (it comes from a PR body), and this server runs on a developer's
 * machine next to localhost services and cloud metadata endpoints. Guards, all enforced here:
 *  - http/https only, no userinfo; no cookies / auth headers are ever sent;
 *  - the connection goes to an address WE vetted (custom `lookup`), so DNS rebinding between the
 *    check and the connect is impossible; literal IPs are checked up front;
 *  - redirects are followed manually (≤ 3) and every hop is re-validated the same way;
 *  - 5 s timeout, 512 KB streamed byte cap, content-type allowlist, HTML stripped to text.
 * It never throws: every refusal is `{ status: 'unavailable', reason }` with a short reason.
 */

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const DEFAULT_MAX_CHARS = 6_000;
const ALLOWED_TYPES = ['text/html', 'text/plain', 'text/markdown', 'application/json'];

class Refused extends Error {}

type LookupCb = (
  err: NodeJS.ErrnoException | null,
  address: string | { address: string; family: number }[],
  family?: number,
) => void;

/** DNS lookup that only yields public addresses; a single blocked answer refuses the host. */
function guardedLookup(
  hostname: string,
  options: { all?: boolean } | number | undefined,
  cb: LookupCb,
): void {
  dnsLookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return cb(err, '', 4);
    if (addrs.length === 0 || addrs.some((a) => isBlockedAddress(a.address))) {
      return cb(new Refused('address not allowed') as NodeJS.ErrnoException, '', 4);
    }
    if (typeof options === 'object' && options?.all) return cb(null, addrs);
    return cb(null, addrs[0]!.address, addrs[0]!.family);
  });
}

function parseUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Refused('invalid URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Refused('only http(s) links are fetched');
  if (u.username || u.password) throw new Refused('URL with credentials is not fetched');
  const host = u.hostname.startsWith('[') ? u.hostname.slice(1, -1) : u.hostname;
  if (isIP(host) && isBlockedAddress(host)) throw new Refused('address not allowed');
  return u;
}

interface RawResponse {
  status: number;
  location?: string;
  contentType: string;
  body: Buffer;
}

function requestOnce(u: URL, deadline: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new Refused('timed out'));
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      u,
      {
        method: 'GET',
        lookup: guardedLookup as never,
        agent: false,
        headers: {
          Accept: 'text/html,text/plain,text/markdown,application/json;q=0.9',
          'Accept-Encoding': 'identity',
          'User-Agent': 'DevDigest-IntentFetcher/1.0',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers['content-type'] ?? '').toLowerCase();
        const location = typeof res.headers.location === 'string' ? res.headers.location : undefined;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location, contentType, body: Buffer.alloc(0) });
        }
        const declared = Number(res.headers['content-length'] ?? 0);
        if (declared > MAX_BYTES) {
          res.destroy();
          return reject(new Refused('response too large'));
        }
        if (status >= 200 && status < 300 && !ALLOWED_TYPES.some((t) => contentType.startsWith(t))) {
          res.destroy();
          return reject(new Refused('content type not allowed'));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new Refused('response too large'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve({ status, contentType, body: Buffer.concat(chunks) }));
        res.on('error', (e) => reject(e));
      },
    );
    req.setTimeout(remaining, () => req.destroy(new Refused('timed out')));
    req.on('error', (e) => reject(e));
    req.end();
  });
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Reduce an HTML document to readable text + its <title>. */
export function htmlToText(html: string): { text: string; title: string | null } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? decodeEntities(titleMatch[1]!).replace(/\s+/g, ' ').trim() || null : null;
  const text = html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return {
    text: decodeEntities(text)
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .trim(),
    title,
  };
}

export class SafeLinkFetcher implements LinkFetcher {
  constructor(private readonly maxChars = DEFAULT_MAX_CHARS) {}

  async fetch(url: string): Promise<FetchedLink> {
    const deadline = Date.now() + TIMEOUT_MS;
    try {
      let u = parseUrl(url);
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const res = await requestOnce(u, deadline);
        if (res.status >= 300 && res.status < 400) {
          if (!res.location) throw new Refused(`HTTP ${res.status} without Location`);
          if (hop === MAX_REDIRECTS) throw new Refused('too many redirects');
          u = parseUrl(new URL(res.location, u).toString());
          continue;
        }
        if (res.status < 200 || res.status >= 300) {
          return { status: 'unavailable', reason: `HTTP ${res.status}` };
        }
        const raw = res.body.toString('utf8');
        const isHtml = res.contentType.startsWith('text/html');
        const parsed = isHtml ? htmlToText(raw) : { text: raw.trim(), title: null };
        return { status: 'fetched', text: parsed.text.slice(0, this.maxChars), title: parsed.title };
      }
      return { status: 'unavailable', reason: 'too many redirects' };
    } catch (err) {
      return { status: 'unavailable', reason: reasonOf(err) };
    }
  }
}

/** A short, non-sensitive reason: our own refusals verbatim, everything else generic. */
function reasonOf(err: unknown): string {
  if (err instanceof Refused) return err.message;
  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'host not found';
  if (code === 'ECONNREFUSED') return 'connection refused';
  if (code === 'ECONNRESET') return 'connection reset';
  return 'fetch failed';
}
