import test from 'node:test';
import assert from 'node:assert/strict';
import { collectHtml, HTML_LIMITS } from '../scripts/html-budget.mjs';
import { extractArticle } from '../scripts/article.mjs';

const originalUrl = 'https://www.ft.com/content/public-test';
const sourceUrl = `https://archive.is/20260901123456/${originalUrl}`;
const title = 'A public assessment of the international energy market';
const prose = 'Researchers examined the supply and demand for energy across a range of countries. Their report describes the assumptions and evidence behind its conclusions, with observations about investment and the regional differences affecting long term planning. ';
const page = extra => `<html><head><title>${title}</title><style>.secret { display:none; } @media print { article { display:none; } }</style></head><body><article><h1>${title}</h1>${`<p>${prose}</p>`.repeat(6)}${extra}</article></body></html>`;
async function* split(value, size = 4096) { const bytes = Buffer.from(value); for (let i = 0; i < bytes.length; i += size) yield bytes.subarray(i, i + size); }
const extract = html => extractArticle(html, { originalUrl, sourceUrl });

test('large script and comment noise is discarded while final article text survives', async () => {
  const html = page(`<script>${'x'.repeat(5_000_000)}</script><!--${'n'.repeat(5_000_000)}--><p>VISIBLE_FINAL_PARAGRAPH ${prose}</p>`);
  const result = await collectHtml(split(html));
  assert.ok(result.processing.input_bytes > 10_000_000);
  assert.ok(result.processing.html_bytes < 5000);
  assert.ok(result.processing.removed_noncontent_bytes >= 10_000_000);
  const article = extract(result.body);
  assert.equal(article.status, 'readable');
  assert.ok(article.text.includes('VISIBLE_FINAL_PARAGRAPH'));
  assert.equal(article.completeness, 'unknown');
});

test('archive-style markup over the former 8MB limit is admitted without dropping styling', async () => {
  const styles = 'color:rgb(10, 10, 10);padding-left:0px;margin-right:0px;'.repeat(15);
  const markup = `<span style="${styles}"></span>`.repeat(11_000);
  const html = page(`${markup}<p style="opacity:0">HIDDEN_INLINE</p><p class="secret">HIDDEN_CSS</p>`);
  assert.ok(Buffer.byteLength(html) > 8_000_000);
  const result = await collectHtml(split(html));
  assert.equal(result.body, html);
  const article = extract(result.body);
  assert.equal(article.status, 'readable');
  assert.ok(!article.text.includes('HIDDEN_'));
  assert.equal(article.identity.verified, true);
});

test('split boundaries, quoted angle brackets and raw-text elements preserve meaning', async () => {
  const html = page('<p title="x > y">Visible Unicode café 世界 😀.</p><script>HIDDEN_SERIALIZED_BODY</script><textarea>&lt;script&gt; A literal example</textarea>');
  const one = await collectHtml(split(html, 1));
  const large = await collectHtml(split(html));
  assert.equal(one.body, large.body);
  assert.ok(one.body.includes('café 世界 😀'));
  assert.ok(one.body.includes('<p title="x > y">'));
  assert.ok(!one.body.includes('HIDDEN_SERIALIZED_BODY'));
});

test('visibility, gates, identity mismatch and challenge signals survive compaction', async () => {
  const gated = await collectHtml(split(page('<p class="secret">HIDDEN_BODY</p><aside class="paywall">Subscribe to read the full article</aside><script>"articleBody":"SECRET"</script>')));
  const article = extract(gated.body);
  assert.equal(article.status, 'partial');
  assert.ok(!article.text.includes('HIDDEN_BODY'));
  assert.ok(!article.text.includes('SECRET'));
  assert.equal(extractArticle(gated.body, { originalUrl: 'https://www.ft.com/content/different', sourceUrl }).status, 'mismatch');
  const challenge = await collectHtml(split('<html><head><title>Security verification</title></head><body><form id="challenge-form">Verify you are human</form></body></html>'));
  assert.equal(extract(challenge.body).status, 'blocked');
});

test('oversized actual prose, retained markup and input noise fail explicitly', async () => {
  await assert.rejects(collectHtml(split(page(`<p>${'actual prose '.repeat(100_000)}</p>`))), /response_too_large/);
  await assert.rejects(collectHtml(split(page('')), { maxBytes: 200 }), /response_too_large/);
  await assert.rejects(collectHtml(split(`<script>${'x'.repeat(2000)}</script>`), { maxInputBytes: 1000 }), /response_too_large/);
  await assert.rejects(collectHtml(split('<div></div>'.repeat(100)), { maxElements: 99 }), /too_many_elements/);
  await assert.rejects(collectHtml(split(`<div title="${'x'.repeat(1000)}">`, 10), { maxTokenBytes: 500 }), /response_too_large/);
  assert.equal(HTML_LIMITS.maxInputBytes, 24_000_000);
});

test('script siblings retain CSS visibility selectors after serialized bodies are removed', async () => {
  const html = page('<script data-state="active">SERIALIZED_BODY</script><p>HIDDEN_ADJACENT</p><script></script><p>HIDDEN_EMPTY_SIBLING</p>').replace('</head>', '<style>script[data-state]:not(:empty) + p { visibility:hidden; } script:empty + p { display:none; }</style></head>');
  const compacted = await collectHtml(split(html, 3));
  assert.ok(compacted.body.includes('<script data-state="active"> </script>'));
  assert.ok(compacted.body.includes('<script></script>'));
  const article = extract(compacted.body);
  assert.equal(article.status, 'readable');
  assert.ok(!article.text.includes('HIDDEN_'));
  assert.ok(!article.text.includes('SERIALIZED_BODY'));
});
