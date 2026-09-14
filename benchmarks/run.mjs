#!/usr/bin/env node
import { readFile, writeFile, mkdir, access, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { fixtures, checkFixture } from './fixtures.mjs';
import { scheduledFetcher, summarize, routeOf } from './support.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const usage = 'node benchmarks/run.mjs [--live] [--reader PATH/article.mjs] [--output PATH.json] [--concurrency 1|2] [--limit 1..25]';
async function fingerprint(reader) {
  const files = (await readdir(dirname(reader))).filter(name => /\.(?:mjs|cjs|js)$/.test(name)).sort();
  const fingerprints = {};
  for (const name of files) fingerprints[name] = hash(await readFile(resolve(dirname(reader), name)));
  for (const name of ['package.json', 'package-lock.json']) {
    try { fingerprints[name] = hash(await readFile(resolve(dirname(reader), '..', name))); } catch { /* optional lockfile */ }
  }
  return fingerprints;
}
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log(usage); process.exit(0); }
const opts = { live: false, concurrency: 2 };
while (args.length) {
  const key = args.shift();
  if (key === '--live') { opts.live = true; continue; }
  const field = { '--reader': 'reader', '--output': 'output', '--concurrency': 'concurrency', '--limit': 'limit' }[key];
  if (!field || !args.length) throw new Error(usage);
  opts[field] = args.shift();
}
opts.concurrency = Number(opts.concurrency);
if (![1, 2].includes(opts.concurrency)) throw new Error('concurrency must be 1 or 2');
if (opts.limit && (!/^\d+$/.test(opts.limit) || Number(opts.limit) < 1 || Number(opts.limit) > 25)) throw new Error('limit must be 1..25');
let reader = opts.reader && resolve(opts.reader);
if (!reader) {
  for (const candidate of [resolve(here, '../scripts/article.mjs'), resolve(here, '../skills/byewall/scripts/article.mjs')]) {
    try { await access(candidate); reader = candidate; break; } catch { /* inspect next documented layout */ }
  }
}
if (!reader) throw new Error('Reader not found; use --reader PATH/article.mjs');
const { readArticle, extractArticle } = await import(pathToFileURL(reader).href);
const sourceBefore = await fingerprint(reader);
const corpusText = await readFile(resolve(here, 'corpus.v1.json'), 'utf8');
const corpus = JSON.parse(corpusText);
if (corpus.articles.length !== 25 || new Set(corpus.articles.map(row => row.url)).size !== 25) throw new Error('corpus must contain 25 distinct URLs');
const started = new Date().toISOString();
const report = {
  schema_version: 1, started_at: started, mode: opts.live ? 'live-and-synthetic' : 'synthetic-only',
  corpus: { version: corpus.version, sha256: hash(corpusText), selected_at: corpus.selected_at, total_articles: corpus.articles.length },
  environment: { node: process.version, platform: process.platform, architecture: process.arch },
  reader_fingerprints: sourceBefore,
  policy: { article_concurrency: opts.concurrency, per_provider_concurrency: 1, provider_interval_ms: 2000, retry_count: 0, circuit_breaker: 'Run-long stop for provider family after HTTP 429 or explicit verification screen; archive mirrors share one family.', browser_automation: false, auth_or_cookies: false, archive_capture: false },
  definitions: { extraction_candidate: 'Reader returned readable; completeness remains unknown and text was not compared against an independently complete article.', browser_followup_candidate: 'Non-readable outcome other than mismatch; a follow-up proxy, not measured browser necessity or browser success.', classification_accuracy: 'Expected statuses and constraints on synthetic fixtures only; no live completeness ground truth.' },
  synthetic: [], live: []
};
for (const fixture of fixtures) {
  const start = performance.now();
  const result = extractArticle(fixture.html, fixture.options);
  const errors = checkFixture(result, fixture.expected);
  report.synthetic.push({ id: fixture.id, expected_status: fixture.expected.status, actual_status: result.status, word_count: result.word_count, passed: errors.length === 0, errors, elapsed_ms: Math.round(performance.now() - start) });
}
report.synthetic_summary = { cases: fixtures.length, passed: report.synthetic.filter(row => row.passed).length };
report.synthetic_summary.classification_and_constraint_pass_rate = report.synthetic_summary.passed / fixtures.length;
if (opts.live) {
  const { fetchPublic } = await import(pathToFileURL(resolve(dirname(reader), 'public-fetch.mjs')).href);
  const schedule = scheduledFetcher(fetchPublic, extractArticle);
  const selected = corpus.articles.slice(0, opts.limit ? Number(opts.limit) : undefined);
  let next = 0;
  const rows = new Array(selected.length);
  await Promise.all(Array.from({ length: opts.concurrency }, async () => {
    for (;;) {
      const index = next++;
      if (index >= selected.length) break;
      const article = selected[index];
      const start = performance.now();
      const result = await readArticle(article.url, { expectedTitle: article.expected_title || undefined, fetcher: schedule.fetcher });
      // Explicit allowlist: raw HTML, article prose, and arbitrary response headers never enter reports.
      rows[index] = { id: article.id, publisher: article.publisher, original_url: article.url, source_url: result.source_url, status: result.status, word_count: result.word_count, text_characters: result.text.length, published_at: result.published_at, captured_at: result.captured_at, retrieved_at: result.retrieved_at, route: routeOf(result.source_url, article.url), identity: result.identity, completeness: result.completeness, reasons: result.reasons, attempts: result.attempts, elapsed_ms: Math.round(performance.now() - start), browser_followup_candidate: !['readable', 'mismatch'].includes(result.status), full_text_verified: null };
      console.error(`${index + 1}/${selected.length} ${article.id}: ${result.status} (${result.word_count} words)`);
    }
  }));
  report.live = rows;
  report.network_events = schedule.events;
  report.live_summary = summarize(rows);
  report.live_summary.provider_cooldown_skips = schedule.events.filter(event => event.outcome === 'skipped_provider_cooldown').length;
  report.live_summary.per_publisher = Object.fromEntries([...new Set(rows.map(row => row.publisher))].map(publisher => [publisher, summarize(rows.filter(row => row.publisher === publisher))]));
  report.live_summary.full_corpus_run = rows.length === corpus.articles.length;
}
report.finished_at = new Date().toISOString();
report.reader_unchanged_during_run = JSON.stringify(sourceBefore) === JSON.stringify(await fingerprint(reader));
report.corpus_unchanged_during_run = hash(corpusText) === hash(await readFile(resolve(here, 'corpus.v1.json')));
const out = opts.output ? resolve(opts.output) : resolve(here, 'results', `${started.replace(/[:.]/g, '-')}-${opts.live ? 'live' : 'synthetic'}.json`);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ report: out, synthetic: report.synthetic_summary, live: report.live_summary, source_unchanged: report.reader_unchanged_during_run }, null, 2));
if (report.synthetic_summary.passed !== fixtures.length || !report.reader_unchanged_during_run || !report.corpus_unchanged_during_run) process.exitCode = 1;
