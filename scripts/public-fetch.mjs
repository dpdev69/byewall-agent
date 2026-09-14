import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP, BlockList } from 'node:net';
import core from './core.cjs';
import { collectHtml, HTML_LIMITS, HtmlBudgetFailure } from './html-budget.mjs';

const blocked = new BlockList();
for (const [ip, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) blocked.addSubnet(ip, prefix, 'ipv4');
const v6 = new BlockList();
v6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new BlockList();
blockedV6.addSubnet('2001::', 23, 'ipv6');
blockedV6.addSubnet('2001:db8::', 32, 'ipv6');
blockedV6.addSubnet('2002::', 16, 'ipv6');
export const isPublicAddress = address => isIP(address) === 4 ? !blocked.check(address, 'ipv4') : isIP(address) === 6 && v6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');

export class FetchFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
const archiveHosts = new Set(['archive.is','archive.today','archive.ph','archive.li','archive.vn','archive.fo','archive.md','web.archive.org']);
export function publicUrl(raw) {
  try {
    const url = new URL(raw);
    if (archiveHosts.has(url.hostname.toLowerCase())) {
      const check = new URL(url);
      check.hostname = 'public-archive-check.org';
      core.prepareUrl(check.href);
      const path = decodeURIComponent(url.pathname);
      if (url.hostname === 'web.archive.org') {
        if (!/^\/web\/(?:\d+[^/]*|\*)\/https?:\/\//i.test(path)) throw new Error();
      } else {
        if (/^\/(?:submit|save|capture|api)(?:\/|$)/i.test(path)) throw new Error();
        if (!/^\/(?:[a-z0-9]{3,24}\/?|(?:newest|\d{8,14})\/https?:\/\/.+)$/i.test(path)) throw new Error();
      }
      const nested = path.match(/\/(https?:\/\/.+)$/i)?.[1];
      if (nested) core.prepareUrl(nested + url.search);
      // Nested original URLs must not smuggle secrets into archive lookups.
      const decoded = decodeURIComponent(url.href);
      if (/[?&](?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|auth|authorization|api[_-]?key|key|secret|password|passwd|session(?:id)?|sid|signature|sig|code|email|x-amz-[^=]+|x-goog-[^=]+)=/i.test(decoded)) throw new Error();
      url.hash = '';
      return url.href;
    }
    return core.prepareUrl(url.href);
  } catch { throw new FetchFailure('unsafe_url'); }
}

function nodeTransport(url, { address, signal, maxBytes, maxInputBytes }) {
  return new Promise((resolve, reject) => {
    const client = new URL(url).protocol === 'https:' ? https : http;
    const req = client.get(url, {
      signal,
      headers: { 'User-Agent': 'ByeWallResearch/0.1 (public article reader)', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
      lookup: (_hostname, options, callback) => options.all ? callback(null, [address]) : callback(null, address.address, address.family)
    }, res => {
      const headers = res.headers;
      if ([301,302,303,307,308].includes(res.statusCode)) { res.destroy(); resolve({ status: res.statusCode, headers, body: '' }); return; }
      if (headers['content-encoding'] && headers['content-encoding'] !== 'identity') { res.destroy(); reject(new FetchFailure('unsupported_encoding')); return; }
      if (Number(headers['content-length']) > maxInputBytes) { res.destroy(); reject(new FetchFailure('response_too_large')); return; }
      collectHtml(res, { maxBytes, maxInputBytes }).then(
        result => resolve({ status: res.statusCode, headers, ...result }),
        error => { res.destroy(); reject(error); }
      );
    });
    req.on('error', reject);
  });
}

// Validate all DNS answers, then pin the selected answer to the socket lookup.
// The same policy is applied anew before every redirected request.
export async function fetchPublic(raw, { resolveDns = lookup, transport = nodeTransport, timeoutMs = 12000, maxBytes = HTML_LIMITS.maxBytes, maxInputBytes = HTML_LIMITS.maxInputBytes, maxRedirects = 4 } = {}) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new FetchFailure('timeout')); }, timeoutMs); });
  const work = async () => {
    let url = publicUrl(raw);
    for (let redirects = 0; redirects <= maxRedirects; redirects++) {
      const addresses = await resolveDns(new URL(url).hostname, { all: true, verbatim: true });
      if (controller.signal.aborted) throw new FetchFailure('timeout');
      if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new FetchFailure('nonpublic_address');
      const response = await transport(url, { address: addresses[0], signal: controller.signal, maxBytes, maxInputBytes });
      if (controller.signal.aborted) throw new FetchFailure('timeout');
      if (Buffer.byteLength(response.body || '') > maxBytes) throw new FetchFailure('response_too_large');
      if ([301,302,303,307,308].includes(response.status)) {
        if (!response.headers.location) throw new FetchFailure('invalid_redirect');
        if (redirects === maxRedirects) throw new FetchFailure('redirect_limit');
        url = publicUrl(new URL(response.headers.location, url).href);
        continue;
      }
      const type = response.headers['content-type'] || '';
      if (response.status >= 200 && response.status < 300 && !/^(?:text\/html|application\/xhtml\+xml)\b/i.test(type)) throw new FetchFailure('unsupported_content_type');
      if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') throw new FetchFailure('unsupported_encoding');
      return { ...response, sourceUrl: url };
    }
  };
  try { return await Promise.race([work(), timeout]); }
  catch (error) { throw error instanceof FetchFailure || error instanceof HtmlBudgetFailure ? error : new FetchFailure('network_error'); }
  finally { clearTimeout(timer); controller.abort(); }
}
