import test from 'node:test';
import assert from 'node:assert/strict';
import { extractArticle, readArticle } from '../scripts/article.mjs';
import { fetchPublic, publicUrl, isPublicAddress } from '../scripts/public-fetch.mjs';

const original = 'https://www.ft.com/content/12345678';
const title = 'Researchers publish an independent assessment of global energy markets';
const paragraph = 'The research team published its assessment after examining supply and demand across several international energy markets. Their observations show a changing pattern of investment, with results varying across regions and technologies. The report provides data and describes the assumptions used in the analysis.';
const article = (extra = '', head = '') => `<html><head><title>${title}</title><meta property="article:published_time" content="2026-09-01T12:00:00Z">${head}</head><body><main><article><h1>${title}</h1>${Array.from({length: 5}, (_, i) => `<p>${paragraph} This is section ${i + 1}.</p>`).join('')}${extra}</article></main></body></html>`;
const extract = (html, extra = {}) => extractArticle(html, { originalUrl: original, sourceUrl: original, ...extra });

test('extracts readable article with date and explicit unknown completeness', () => {
  const result = extract(article());
  assert.equal(result.status, 'readable');
  assert.equal(result.title, title);
  assert.equal(result.published_at, '2026-09-01T12:00:00.000Z');
  assert.equal(result.completeness, 'unknown');
  assert.ok(result.word_count > 200);
  assert.ok(result.text.includes('section 5'));
  assert.equal(result.identity.verified, true);
});
test('short text is partial even without a gate', () => {
  const result = extract(`<html><head><title>${title}</title></head><body><article><h1>${title}</h1><p>${paragraph}</p></article></body></html>`);
  assert.equal(result.status, 'partial');
});
test('subscription teaser remains partial and gate prompt is removed', () => {
  const result = extract(article('<aside class="paywall">Subscribe to read the full article</aside>'));
  assert.equal(result.status, 'partial');
  assert.ok(!result.text.includes('Subscribe to read'));
});
test('plain unclassified div subscription prompt is still a gate', () => {
  const result = extract(article('<div>Subscribe to continue reading. Already a subscriber? Sign in.</div>'));
  assert.equal(result.status, 'partial');
  assert.ok(!result.text.includes('Subscribe to continue'));
});
test('prose discussing paywalls does not become a gate', () => {
  const result = extract(article('<p>Publishers sometimes ask readers to subscribe to read the full article, which was the subject of the team\'s separate study.</p>'));
  assert.equal(result.status, 'readable');
});
test('challenge returns no article text', () => {
  const result = extract('<html><head><title>Just a moment...</title></head><body><form id="challenge-form">Verify you are human</form></body></html>');
  assert.equal(result.status, 'blocked');
  assert.equal(result.text, '');
  assert.equal(result.identity.verified, false);
});
test('HTTP failures cannot be mistaken for articles', () => {
  assert.equal(extract(article(), { httpStatus: 403 }).status, 'blocked');
  assert.equal(extract(article(), { httpStatus: 404 }).status, 'unavailable');
  const mismatch = { expectedTitle: 'A totally unrelated story about whales' };
  assert.equal(extract(article(), { ...mismatch, httpStatus: 403 }).status, 'blocked');
  assert.equal(extract(article(), { ...mismatch, httpStatus: 404 }).status, 'unavailable');
  assert.equal(extract('<html><head><title>Security Verification</title></head><body>Verify you are human</body></html>', mismatch).status, 'blocked');
});
test('wrong expected title is a mismatch and withholds text', () => {
  const result = extract(article(), { expectedTitle: 'An entirely unrelated story concerning marine biology and whales' });
  assert.equal(result.status, 'mismatch');
  assert.equal(result.text, '');
  assert.equal(result.identity.verified, false);
});
test('an unverified candidate needs review; matching title can establish identity', () => {
  const extra = { sourceUrl: 'https://syndication.org/news/copy' };
  assert.equal(extract(article(), extra).status, 'needs_review');
  assert.equal(extract(article(), { ...extra, expectedTitle: title }).status, 'readable');
});
test('near match title alone is not sufficient to identify a syndicated article', () => {
  assert.equal(extract(article(), { sourceUrl: 'https://syndication.org/news/copy', expectedTitle: `${title} today` }).status, 'needs_review');
});
test('candidate canonical identity works and unsafe canonical is not leaked', () => {
  assert.equal(extract(article('', `<link rel="canonical" href="${original}">`), { sourceUrl: 'https://syndication.org/news/copy' }).status, 'readable');
  const result = extract(article('', '<link rel="canonical" href="https://site.org/story?token=TOPSECRET">'), { sourceUrl: 'https://syndication.org/news/copy' });
  assert.equal(result.status, 'needs_review');
  assert.ok(!JSON.stringify(result).includes('TOPSECRET'));
});
test('Wayback snapshot provides capture and original identity', () => {
  const result = extract(article(), { sourceUrl: `https://web.archive.org/web/20260901123456/${original}` });
  assert.equal(result.status, 'readable');
  assert.equal(result.captured_at, '2026-09-01T12:34:56.000Z');
  assert.ok(result.identity.evidence.includes('archive_url_matches_original'));
});
test('Archive.today timestamp source provides capture date', () => {
  const result = extract(article(), { sourceUrl: `https://archive.is/20260901123456/${original}` });
  assert.equal(result.status, 'readable');
  assert.equal(result.captured_at, '2026-09-01T12:34:56.000Z');
});
test('archive toolbar time is never a publisher publication date', () => {
  const sourceUrl = `https://archive.is/20260901123456/${original}`;
  const html = article().replace('<body>', '<body><div id="HEADER"><time datetime="2026-09-01T12:34:56Z">Captured</time></div>');
  const result = extract(html, { sourceUrl });
  assert.equal(result.published_at, null);
  assert.equal(result.captured_at, '2026-09-01T12:34:56.000Z');
  const scoped = extract(html.replace('<article>', '<article><time datetime="2026-08-30T10:00:00Z">Published</time>'), { sourceUrl });
  assert.equal(scoped.published_at, '2026-08-30T10:00:00.000Z');
});
test('wrong archive target is a mismatch', () => {
  assert.equal(extract(article(), { sourceUrl: 'https://web.archive.org/web/20260901123456/https://www.ft.com/content/different' }).status, 'mismatch');
});
test('hidden DOM and serialized bodies never appear in extraction', () => {
  const html = article('<p hidden>HIDDEN_ALPHA</p><p aria-hidden="true">HIDDEN_BETA</p><p style="display: none">HIDDEN_GAMMA</p><p class="secret">HIDDEN_DELTA</p><script type="application/ld+json">{"articleBody":"HIDDEN_EPSILON"}</script><template>HIDDEN_ZETA</template>', '<style>.secret { visibility: hidden; }</style>');
  const result = extract(html);
  assert.equal(result.status, 'readable');
  assert.ok(!result.text.includes('HIDDEN_'));
});
test('print-only visibility rules do not delete the public article', () => {
  const result = extract(article('', '<style>@media print { article { display: none; } }</style>'));
  assert.equal(result.status, 'readable');
  assert.ok(result.text.includes('section 5'));
});
test('empty and missing archive result are unavailable', () => {
  assert.equal(extract('<html><body></body></html>').status, 'unavailable');
  assert.equal(extract('<html><head><title>Wayback Machine</title></head><body>This URL has not been archived.</body></html>').status, 'unavailable');
});
test('workflow tries providers sequentially then stops after readable', async () => {
  const called = [];
  const result = await readArticle(original, { fetcher: async url => {
    called.push(url);
    return { status: url === original ? 403 : 200, body: article(), sourceUrl: url };
  } });
  assert.equal(result.status, 'readable');
  assert.deepEqual(called, [original, `https://archive.is/newest/${original}`]);
  assert.equal(result.attempts.length, 2);
});
test('candidate mode only contacts candidate; no-archives only original', async () => {
  const called = [];
  const fetcher = async url => { called.push(url); return { status: 403, body: '', sourceUrl: url }; };
  await readArticle(original, { candidate: 'https://syndication.org/story', fetcher });
  await readArticle(original, { noArchives: true, fetcher });
  assert.deepEqual(called, ['https://syndication.org/story', original]);
});
test('workflow sanitizes unexpected error text', async () => {
  const result = await readArticle(original, { noArchives: true, fetcher: async () => { throw new Error('https://secret.org/?token=SECRET'); } });
  assert.equal(result.status, 'unavailable');
  assert.ok(!JSON.stringify(result).includes('SECRET'));
});
test('a nonpublic original DNS result never gets forwarded to archive providers', async () => {
  const called = [];
  const result = await readArticle(original, { fetcher: async url => { called.push(url); throw Object.assign(new Error('nonpublic_address'), {code:'nonpublic_address'}); } });
  assert.equal(result.status, 'unavailable');
  assert.deepEqual(called, [original]);
});

const dns = async () => [{ address: '93.184.216.34', family: 4 }];
const response = { status: 200, headers: { 'content-type': 'text/html' }, body: '<p>Hello</p>' };
test('public URL policy rejects local endpoints, credentials and secrets', () => {
  for (const url of ['http://localhost/page','http://127.0.0.1/','https://site.org:8080/','https://user:pass@site.org/','https://site.org/?token=SECRET','https://archive.is/newest/https://site.org/?token=SECRET']) assert.throws(() => publicUrl(url), /unsafe_url/);
  assert.equal(publicUrl(original), original);
  assert.equal(publicUrl(`https://archive.is/newest/${original}`), `https://archive.is/newest/${original}`);
});
test('archive submission routes and nonpublic nested targets are rejected', async () => {
  for (const url of ['https://archive.is/submit/?url=https://site.org/story','https://web.archive.org/save/https://site.org/story','https://archive.is/newest/http://127.0.0.1/story','https://web.archive.org/web/2/http://localhost/story','https://archive.is/newest/https://site.org:8443/story']) assert.throws(() => publicUrl(url), /unsafe_url/);
  await assert.rejects(fetchPublic(original, { resolveDns: dns, transport: async () => ({ status: 302, headers: { location: 'https://archive.is/submit/?url=https://site.org/story' }, body: '' }) }), /unsafe_url/);
});
test('private, mapped, reserved and transition addresses are rejected', () => {
  for (const ip of ['127.0.0.1','10.2.3.4','169.254.1.1','100.100.100.100','192.168.1.1','::1','::ffff:127.0.0.1','2001:db8::1','2002:7f00:1::']) assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ['93.184.216.34','2606:4700:4700::1111']) assert.equal(isPublicAddress(ip), true, ip);
});
test('mixed public/private DNS responses fail before transport', async () => {
  let contacted = false;
  await assert.rejects(fetchPublic(original, { resolveDns: async () => [...await dns(), { address: '10.0.0.1', family: 4 }], transport: async () => { contacted = true; return response; } }), /nonpublic_address/);
  assert.equal(contacted, false);
});
test('redirects are checked before contacting destination', async () => {
  const contacted = [];
  await assert.rejects(fetchPublic(original, { resolveDns: dns, transport: async url => { contacted.push(url); return { status: 302, headers: { location: 'http://127.0.0.1/secret' }, body: '' }; } }), /unsafe_url/);
  assert.deepEqual(contacted, [original]);
});
test('DNS policy repeats after redirects and pinned address reaches transport', async () => {
  const contacted = [];
  await assert.rejects(fetchPublic(original, { resolveDns: async host => host === 'www.ft.com' ? dns() : [{ address: '10.0.0.1', family: 4 }], transport: async (url, options) => { assert.equal(options.address.address, '93.184.216.34'); contacted.push(url); return { status: 302, headers: { location: 'https://redirect.org/' }, body: '' }; } }), /nonpublic_address/);
  assert.equal(contacted.length, 1);
});
test('secret-bearing redirects are not reproduced in errors', async () => {
  await assert.rejects(fetchPublic(original, { resolveDns: dns, transport: async () => ({ status: 302, headers: { location: 'https://site.org/?token=SECRET' }, body: '' }) }), error => error.message === 'unsafe_url' && !JSON.stringify(error).includes('SECRET'));
});
test('bounded redirects, bytes, content type, and deadline', async () => {
  await assert.rejects(fetchPublic(original, { resolveDns: dns, maxRedirects: 1, transport: async () => ({ status: 302, headers: { location: original }, body: '' }) }), /redirect_limit/);
  await assert.rejects(fetchPublic(original, { resolveDns: dns, maxBytes: 4, transport: async () => response }), /response_too_large/);
  await assert.rejects(fetchPublic(original, { resolveDns: dns, transport: async () => ({ ...response, headers: { 'content-type': 'application/json' } }) }), /unsupported_content_type/);
  await assert.rejects(fetchPublic(original, { resolveDns: async () => new Promise(() => {}), timeoutMs: 10 }), /timeout/);
});
test('safe public request returns final source', async () => {
  const result = await fetchPublic(original, { resolveDns: dns, transport: async () => response });
  assert.equal(result.sourceUrl, original);
  assert.equal(result.body, response.body);
});
