#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const input = resolve(process.argv[2] || 'benchmarks/results/report.json');
const report = JSON.parse(await readFile(input, 'utf8'));
const s = report.live_summary;
if (!s) throw new Error('A live benchmark report is required');
const rate = value => `${(value * 100).toFixed(1)}%`;
const safe = value => String(value ?? 'unknown').replaceAll('|', '\\|').replaceAll('\n', ' ');
const lines = [
  '# ByeWall v0.1 retrieval benchmark', '',
  ...(!report.reader_unchanged_during_run || !report.corpus_unchanged_during_run ? ['**Exploratory run: source files changed while this process was running. This is not a final-release benchmark.** The results below preserve the observed outcomes, including failures; see the JSON fingerprints and rerun only when the final checkout is stable and providers permit requests.', ''] : []),
  `Run: ${report.started_at} to ${report.finished_at}. Node ${report.environment.node}; ${report.environment.platform}/${report.environment.architecture}.`, '',
  `**${s.extraction_candidates}/${s.attempted_articles} extraction candidates (${rate(s.extraction_candidate_rate)}). Full-text completeness was not independently verified.** This is a fixed convenience sample, not an estimate of Bloomberg, FT, or overall publisher coverage.`, '',
  `${report.synthetic_summary.passed}/${report.synthetic_summary.cases} synthetic classification and constraint cases passed. These results do not establish a live false-positive rate.`, '',
  `All ${s.attempted_articles} selected URLs remain in the denominator. ${s.provider_cooldown_skips} provider lookups were skipped after a previous rate limit or verification screen; these skips affect later results. Median article wall time ${(s.median_elapsed_ms / 1000).toFixed(2)}s; p95 ${(s.p95_elapsed_ms / 1000).toFixed(2)}s, including provider queue waits.`, '',
  `${s.browser_followup_candidates}/${s.attempted_articles} results are browser-follow-up candidates (a triage proxy). This benchmark did not operate a browser or measure browser success.`, '',
  '| Publisher | Articles | Readable candidates | Partial | Needs review | Mismatch | Blocked | Unavailable |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
];
for (const [publisher, value] of Object.entries(s.per_publisher)) lines.push(`| ${publisher} | ${value.attempted_articles} | ${value.statuses.readable} | ${value.statuses.partial} | ${value.statuses.needs_review} | ${value.statuses.mismatch} | ${value.statuses.blocked} | ${value.statuses.unavailable} |`);
lines.push('', '## All article outcomes', '', '| Article | Status | Words | Route | Seconds | Capture date |', '| --- | --- | ---: | --- | ---: | --- |');
for (const row of report.live) lines.push(`| [${row.id}](${row.original_url}) | ${row.status} | ${row.word_count} | ${safe(row.route)} | ${(row.elapsed_ms / 1000).toFixed(2)} | ${safe(row.captured_at)} |`);
lines.push('', '## Reproduction and limitations', '',
  `Corpus v${report.corpus.version}, selected ${report.corpus.selected_at}, SHA-256 \`${report.corpus.sha256}\`. Full corpus run: ${s.full_corpus_run}. Reader unchanged during run: ${report.reader_unchanged_during_run}. Corpus unchanged during run: ${report.corpus_unchanged_during_run}.`, '',
  'The corpus includes two labeled prior smoke-test regression cases and 23 newly selected URLs. Recent FT links and older technology/science stories are not balanced or random samples. Public copies can appear, disappear, change, or challenge future requests. Matching a title/URL and exceeding a word threshold do not prove all article paragraphs were extracted. Missing capture or publication dates are unknown, not inferred.', '',
  'Run `node benchmarks/run.mjs --live` from the repository after `npm ci`. See [methodology](../README.md), [machine-readable report](./report.json), and the [fixed corpus](../corpus.v1.json). The JSON includes every attempt, network outcome, source URL, identity evidence, timing, and reader/dependency fingerprint; no article prose is included.', '');
await writeFile(resolve(dirname(input), 'report.md'), lines.join('\n'), { flag: 'wx' });
