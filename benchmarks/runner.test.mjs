import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduledFetcher, summarize, routeOf } from './support.mjs';
const classify = body => ({ reasons: body === 'challenge' ? ['verification_or_access_screen'] : [] });
test('rate-limited archive stops later mirror requests for the entire run', async () => {
  let calls = 0;
  const scheduled = scheduledFetcher(async url => { calls++; return { status: 429, body: '', sourceUrl: url }; }, classify, { intervalMs: 0 });
  await scheduled.fetcher('https://archive.is/newest/https://example.com/story');
  await assert.rejects(scheduled.fetcher('https://archive.ph/newest/https://example.com/story2'));
  assert.equal(calls, 1);
  assert.equal(scheduled.events.at(-1).outcome, 'skipped_provider_cooldown');
});
test('verification screens stop same provider but leave another publisher available', async () => {
  const calls = [];
  const scheduled = scheduledFetcher(async url => { calls.push(url); return { status: 200, body: url.includes('example.com') ? 'challenge' : '', sourceUrl: url }; }, classify, { intervalMs: 0 });
  await scheduled.fetcher('https://example.com/one');
  await assert.rejects(scheduled.fetcher('https://www.example.com/two'));
  await scheduled.fetcher('https://example.org/other');
  assert.equal(calls.length, 2);
});
test('queued calls never overlap within a provider', async () => {
  let inFlight = 0, peak = 0;
  const scheduled = scheduledFetcher(async url => {
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(resolve => setTimeout(resolve, 5));
    inFlight--; return { status: 200, body: '', sourceUrl: url };
  }, classify, { intervalMs: 0 });
  await Promise.all([1, 2, 3].map(i => scheduled.fetcher(`https://example.com/${i}`)));
  assert.equal(peak, 1);
});
test('empty summaries never imply measured full-text or browser success', () => {
  const result = summarize([]);
  assert.equal(result.extraction_candidate_rate, null);
  assert.equal(result.full_text_verified, null);
  assert.equal(result.browser_success_measured, false);
  assert.equal(routeOf(null, 'https://example.com/article'), 'none');
  assert.equal(routeOf('https://archive.is/abcde', 'https://example.com/article'), 'archive-today');
});
