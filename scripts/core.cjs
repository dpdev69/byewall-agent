/* Shared by all browser builds. No network requests or persistent browsing data. */
(function (root) {
  'use strict';
  const archiveHosts = ['archive.is', 'archive.today', 'archive.ph', 'archive.li', 'archive.vn', 'archive.fo', 'archive.md', 'web.archive.org'];
  const sensitiveKey = /^(?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|auth|authorization|api[_-]?key|key|secret|password|passwd|session(?:id)?|sid|signature|sig|code|email|x-amz-.+|x-goog-.+)$/i;
  function prepareUrl(raw) {
    if (typeof raw !== 'string' || !raw.trim()) throw new Error('Open a public article first, or paste its full https:// address below.');
    if (raw.length > 8192) throw new Error('This address is too long. Paste the public article link instead.');
    let url;
    try { url = new URL(raw.trim()); } catch { throw new Error('Enter a full public web address starting with https:// or http://.'); }
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('ByeWall works with public web pages, not browser settings, files, or other apps.');
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.username || url.password) throw new Error('This address contains sign-in details. Use a public article link instead.');
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /(?:^|\.)(?:localhost|local|internal|intranet|lan|test|invalid|example|onion)$/.test(host) || /(?:^|\.)home\.arpa$/.test(host) || url.port) {
      throw new Error('Local, IP-based, and custom-port addresses are not sent to archives. Use a public article link.');
    }
    if (archiveHosts.some(domain => host === domain || host.endsWith('.' + domain))) throw new Error('You are already viewing an archive. Paste the original article address to try another provider.');
    for (const key of url.searchParams.keys()) {
      if (sensitiveKey.test(key)) throw new Error('This address may contain a private token or personal information. Copy a public article link without those details.');
    }
    if (/^#(?:\/|!)/.test(url.hash)) throw new Error('This page uses an app-style address. Paste a direct public article link instead.');
    // Remove recognized tracking parameters only; preserve article identifiers.
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = host;
    url.hash = '';
    return url.href;
  }
  function destination(raw, provider = 'archive') {
    const url = prepareUrl(raw);
    if (provider === 'archive') return 'https://archive.is/newest/' + url;
    if (provider === 'wayback') return 'https://web.archive.org/web/2/' + url;
    if (provider === 'save') return 'https://archive.is/submit/?url=' + encodeURIComponent(url);
    throw new Error('Choose a supported archive provider.');
  }
  const api = Object.freeze({ prepareUrl, destination });
  root.ByeWall = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
