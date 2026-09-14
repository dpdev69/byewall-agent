import { setTimeout as sleep } from 'node:timers/promises';
const archiveFamily = /^(?:archive\.(?:is|today|ph|li|vn|fo|md)|web\.archive\.org)$/;
const bucket = url => {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return archiveFamily.test(host) ? 'public-archives' : host;
};
// One in-flight lookup per provider family, minimum spacing, and a run-long
// circuit breaker after a rate limit or explicit verification screen.
export function scheduledFetcher(fetchPublic, extractArticle, { intervalMs = 2000, clock = Date.now, wait = sleep } = {}) {
  const providers = new Map();
  const events = [];
  const fetcher = async url => {
    const key = bucket(url);
    if (!providers.has(key)) providers.set(key, { tail: Promise.resolve(), next: 0, stopped: null });
    const state = providers.get(key);
    const work = state.tail.then(async () => {
      if (state.stopped) {
        events.push({ url, provider: key, outcome: 'skipped_provider_cooldown', reason: state.stopped, elapsed_ms: 0 });
        const error = new Error('provider_cooldown'); error.code = 'network_error'; throw error;
      }
      await wait(Math.max(0, state.next - clock()));
      const started = clock();
      try {
        const response = await fetchPublic(url);
        const classified = extractArticle(response.body, { originalUrl: 'https://example.com/benchmark-probe', sourceUrl: response.sourceUrl, httpStatus: response.status });
        if (response.status === 429 || classified.reasons.includes('verification_or_access_screen')) state.stopped = response.status === 429 ? 'http_429' : 'verification_screen';
        events.push({ url, source_url: response.sourceUrl, provider: key, outcome: 'response', http_status: response.status, elapsed_ms: clock() - started });
        return response;
      } catch (error) {
        events.push({ url, provider: key, outcome: 'fetch_error', error: error.code || 'retrieval_failed', elapsed_ms: clock() - started });
        throw error;
      } finally { state.next = clock() + intervalMs; }
    });
    state.tail = work.catch(() => {});
    return work;
  };
  return { fetcher, events };
}
export const routeOf = (source, original) => {
  if (!source) return 'none';
  const sourceHost = new URL(source).hostname;
  if (archiveFamily.test(sourceHost)) return sourceHost === 'web.archive.org' ? 'wayback' : 'archive-today';
  return sourceHost.replace(/^www\./, '') === new URL(original).hostname.replace(/^www\./, '') ? 'original' : 'other-public';
};
export function summarize(rows) {
  const count = predicate => rows.filter(predicate).length;
  const times = rows.map(row => row.elapsed_ms).sort((a, b) => a - b);
  return {
    attempted_articles: rows.length,
    statuses: Object.fromEntries(['readable', 'partial', 'needs_review', 'mismatch', 'blocked', 'unavailable'].map(status => [status, count(row => row.status === status)])),
    extraction_candidates: count(row => row.status === 'readable'),
    extraction_candidate_rate: rows.length ? count(row => row.status === 'readable') / rows.length : null,
    full_text_verified: null,
    browser_followup_candidates: count(row => row.browser_followup_candidate),
    browser_success_measured: false,
    median_elapsed_ms: times.length ? times[Math.floor((times.length - 1) / 2)] : null,
    p95_elapsed_ms: times.length ? times[Math.ceil(times.length * .95) - 1] : null
  };
}
