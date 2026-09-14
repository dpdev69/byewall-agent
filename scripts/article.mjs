import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import core from './core.cjs';
import { fetchPublic, publicUrl } from './public-fetch.mjs';

const tidy = value => String(value || '').replace(/\s+/g, ' ').trim();
const words = value => tidy(value).split(/\s+/).filter(Boolean).length;
function* unconditionalCssRules(css) {
  // A static fetch has no viewport/media state. Do not apply conditional @media
  // or @supports blocks as though they were unconditional visibility rules.
  let depth = 0, start = 0, selector = '', contentStart = 0;
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let index = 0; index < css.length; index++) {
    if (css[index] === '{') {
      if (depth === 0) { selector = css.slice(start, index).trim(); contentStart = index + 1; }
      depth++;
    } else if (css[index] === '}') {
      depth--;
      if (depth === 0) { if (selector && !selector.startsWith('@')) yield [selector, css.slice(contentStart, index)]; start = index + 1; }
    }
  }
}
const titleTokens = title => new Set(tidy(title).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean));
function titleMatches(left, right) {
  const a = titleTokens(left), b = titleTokens(right);
  if (!a.size || !b.size) return false;
  const common = [...a].filter(t => b.has(t)).length;
  return a.size >= 5 && b.size >= 5 && common === a.size && common === b.size;
}
function titleRelated(left, right) {
  const a = titleTokens(left), b = titleTokens(right);
  if (!a.size || !b.size) return false;
  const common = [...a].filter(t => b.has(t)).length;
  return common / Math.min(a.size, b.size) >= 0.7 && common / Math.max(a.size, b.size) >= 0.5;
}
function sameArticle(left, right) {
  try {
    const a = new URL(core.prepareUrl(left)), b = new URL(core.prepareUrl(right));
    return a.hostname.replace(/^www\./, '') === b.hostname.replace(/^www\./, '') && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '') && a.search === b.search;
  } catch { return false; }
}
function validDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}
function captureDate(url) {
  const match = url.match(/^https?:\/\/(?:web\.archive\.org\/web|archive\.(?:is|today|ph|li|vn|fo|md))\/(\d{14})[^/]*\//);
  if (!match) return null;
  const t = match[1];
  return validDate(`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}T${t.slice(8,10)}:${t.slice(10,12)}:${t.slice(12,14)}Z`);
}
export function emptyResult(originalUrl, sourceUrl = null) {
  return { status: 'unavailable', original_url: originalUrl, source_url: sourceUrl, title: null, published_at: null, captured_at: null, retrieved_at: new Date().toISOString(), text: '', word_count: 0, identity: { verified: false, evidence: [] }, completeness: 'unknown', reasons: [], attempts: [] };
}

export function extractArticle(html, { originalUrl, sourceUrl, expectedTitle, httpStatus = 200 } = {}) {
  originalUrl = core.prepareUrl(originalUrl);
  sourceUrl = publicUrl(sourceUrl || originalUrl);
  const result = emptyResult(originalUrl, sourceUrl);
  result.captured_at = captureDate(sourceUrl);
  const { document } = parseHTML(html);
  Object.defineProperty(document, 'documentURI', { value: sourceUrl, configurable: true });
  Object.defineProperty(document, 'baseURI', { value: sourceUrl, configurable: true });
  const meta = key => document.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.getAttribute('content');
  const isArchive = /^(?:web\.archive\.org|archive\.(?:is|today|ph|li|vn|fo|md))$/.test(new URL(sourceUrl).hostname);
  result.title = tidy(meta('og:title') || document.querySelector('h1')?.textContent || document.title) || null;
  const scopedTime = document.querySelector('article time[datetime],[itemprop="datePublished"]');
  const publisherTime = scopedTime?.getAttribute('datetime') || scopedTime?.getAttribute('content');
  // Archive toolbars have their own <time>. It is a capture date, never publication.
  result.published_at = validDate(isArchive ? publisherTime : meta('article:published_time') || meta('datePublished') || publisherTime);
  const canonicalRaw = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  let canonical;
  try { if (canonicalRaw) canonical = publicUrl(new URL(canonicalRaw, sourceUrl).href); } catch { /* Do not reproduce unsafe metadata URLs. */ }

  // Use explicit visibility information only. Never mine serialized article bodies.
  for (const style of document.querySelectorAll('style')) {
    for (const [selector, declarations] of unconditionalCssRules(style.textContent)) {
      if (/(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\s|;|!|$))/i.test(declarations)) {
        try { for (const node of document.querySelectorAll(selector)) node.remove(); } catch { /* Unsupported CSS does not execute. */ }
      }
    }
  }
  for (const node of document.querySelectorAll('script,style,noscript,template,[hidden],[aria-hidden="true"],.hidden,.sr-only')) node.remove();
  for (const node of document.querySelectorAll('[style]')) {
    if (/(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\s|;|!|$))/i.test(node.getAttribute('style'))) node.remove();
  }

  const bodyText = tidy(document.body?.textContent);
  const challenge = /^(?:just a moment|access denied|attention required|security verification|(?:Bloomberg\s*[-–|:]\s*)?are you a robot|robot or human|verify (?:that )?you are human|captcha|pardon our interruption)(?:\b|[!?.:])/i.test(result.title || '') || document.querySelector('iframe[src*="captcha"],#challenge-running,#challenge-form,.g-recaptcha,.h-captcha') || (bodyText.length < 2500 && /^Bloomberg(?:\b|\s*[-|])/i.test(result.title || '') && /(?:we.ve detected unusual activity|confirm you.re not a robot|verify (?:that )?you are human)/i.test(bodyText));
  const gatePattern = /(?:subscribe (?:now |today )?to (?:read|continue|unlock)|(?:sign|log) in to (?:read|continue)|already a subscriber|subscription (?:is )?required|unlock (?:this|the) article|(?:read|continue reading) (?:the full|with a subscription)|purchase (?:this|the) article)/i;
  let gate = false;
  for (const node of document.querySelectorAll('button,a,aside,form,[class*="paywall"],[id*="paywall"],[class*="subscription-wall"],[class*="registration-wall"]')) {
    if (tidy(node.textContent).length < 1200 && gatePattern.test(tidy(node.textContent))) { gate = true; node.remove(); }
  }
  // Standalone prompts are gates; prose that discusses subscriptions is not.
  for (const node of document.querySelectorAll('p,h1,h2,h3,div,span')) {
    if (node.querySelector('p,article,main,div,h1,h2,h3')) continue;
    if (/^(?:subscribe (?:now |today )?to (?:read|continue|unlock)|(?:sign|log) in to (?:read|continue)|subscription (?:is )?required|already a subscriber\??$)/i.test(tidy(node.textContent)) && tidy(node.textContent).length < 180) { gate = true; node.remove(); }
  }

  if (sameArticle(sourceUrl, originalUrl)) result.identity.evidence.push('source_url_matches_original');
  if (canonical && sameArticle(canonical, originalUrl)) result.identity.evidence.push('canonical_matches_original');
  const archiveTarget = sourceUrl.match(/^https?:\/\/(?:web\.archive\.org\/web\/\d+[^/]*|archive\.(?:is|today|ph|li|vn|fo|md)\/(?:newest|\d{8,14}))\/(https?:\/\/.+)$/)?.[1];
  if (archiveTarget && sameArticle(archiveTarget, originalUrl)) result.identity.evidence.push('archive_url_matches_original');
  // Archive.is short snapshot pages typically identify their original via og:url or toolbar link.
  const ogUrl = meta('og:url');
  if (/^https?:\/\/archive\.(?:is|today|ph|li|vn|fo|md)\//.test(sourceUrl)) {
    if (sameArticle(ogUrl, originalUrl) || [...document.querySelectorAll('#HEADER a[href],#HEADER input[value]')].some(node => sameArticle(node.getAttribute('href') || node.getAttribute('value'), originalUrl))) result.identity.evidence.push('archive_metadata_matches_original');
  }
  if (isArchive) for (const node of document.querySelectorAll('#HEADER,#FOOTER,#wm-ipp-base')) node.remove();
  for (const node of document.querySelectorAll('#comments,.comments,.comment-list,.o-comments,[data-component="o-comments"],[data-spotim-module]')) node.remove();
  if (expectedTitle && titleMatches(result.title, expectedTitle)) result.identity.evidence.push('expected_title_matches');
  result.identity.verified = result.identity.evidence.length > 0;
  const explicitMismatch = (expectedTitle && result.title && !titleRelated(result.title, expectedTitle) && !challenge && !gate) || (archiveTarget && !sameArticle(archiveTarget, originalUrl));
  if ([401,403,429].includes(httpStatus) || challenge) { result.status = 'blocked'; result.identity.verified = false; result.reasons.push(challenge ? 'verification_or_access_screen' : `http_${httpStatus}`); return result; }
  if (httpStatus < 200 || httpStatus >= 300) { result.identity.verified = false; result.reasons.push(`http_${httpStatus}`); return result; }
  if (/^(?:page not found|404(?:\b|:)|not found|no results|wayback machine|internet archive wayback machine)$/i.test(result.title || '') || (bodyText.length < 1500 && /(?:has not archived that URL|no (?:archived |saved )?(?:snapshots|captures)|not been archived)/i.test(bodyText))) { result.identity.verified = false; result.reasons.push('no_article_found'); return result; }
  if (explicitMismatch) { result.status = 'mismatch'; result.identity.verified = false; result.reasons.push('article_identity_mismatch'); return result; }

  let parsed;
  try { parsed = new Readability(document, { charThreshold: 200, maxElemsToParse: 50000, disableJSONLD: true }).parse(); } catch { result.identity.verified = false; result.reasons.push('extraction_failed'); return result; }
  if (!parsed) { result.status = gate ? 'blocked' : 'unavailable'; result.identity.verified = false; result.reasons.push(gate ? 'subscription_prompt' : 'no_article_text'); return result; }
  const extracted = parseHTML(`<html><body>${parsed.content}</body></html>`).document;
  const paragraphs = [...extracted.querySelectorAll('p,h1,h2,h3,h4,li,blockquote,pre')].filter(n => !n.parentElement?.closest('p,li,blockquote,pre')).map(n => tidy(n.textContent)).filter(Boolean);
  result.text = paragraphs.length ? paragraphs.join('\n\n') : tidy(parsed.textContent);
  result.word_count = words(result.text);
  if (!result.word_count) { result.status = gate ? 'blocked' : 'unavailable'; result.identity.verified = false; result.reasons.push('no_article_text'); return result; }
  if (gate) { result.status = 'partial'; result.reasons.push('subscription_prompt_visible'); }
  else if (result.word_count < 100) { result.status = 'partial'; result.reasons.push('short_extraction_requires_review'); }
  else if (!result.identity.verified) { result.status = 'needs_review'; result.reasons.push('article_identity_unconfirmed'); }
  else { result.status = 'readable'; result.reasons.push('readable_text_found_fullness_unverified'); }
  return result;
}

export async function readArticle(original, { candidate, expectedTitle, noArchives = false, fetcher = fetchPublic } = {}) {
  const originalUrl = core.prepareUrl(original);
  const urls = candidate ? [publicUrl(candidate)] : [originalUrl, ...(noArchives ? [] : [core.destination(originalUrl), core.destination(originalUrl, 'wayback')])];
  const attempts = [];
  let best = emptyResult(originalUrl);
  const rank = { unavailable: 0, blocked: 1, mismatch: 2, needs_review: 3, partial: 4, readable: 5 };
  for (const url of urls) {
    let result;
    try {
      const response = await fetcher(url);
      result = extractArticle(response.body, { originalUrl, sourceUrl: response.sourceUrl, expectedTitle, httpStatus: response.status });
      attempts.push({ url, source_url: result.source_url, status: result.status, http_status: response.status, reasons: result.reasons, ...(response.processing ? { processing: response.processing } : {}) });
    } catch (error) {
      const allowedCodes = new Set(['unsafe_url','timeout','nonpublic_address','response_too_large','too_many_elements','invalid_redirect','redirect_limit','unsupported_content_type','unsupported_encoding','network_error']);
      attempts.push({ url, status: 'unavailable', error: allowedCodes.has(error.code) ? error.code : 'retrieval_failed' });
      // A hostname that resolves private must not be handed to an archive provider.
      if (url === originalUrl && ['unsafe_url', 'nonpublic_address'].includes(error.code)) break;
      continue;
    }
    if (rank[result.status] > rank[best.status] || !best.source_url) best = result;
    if (result.status === 'readable') break;
  }
  best.attempts = attempts;
  return best;
}
