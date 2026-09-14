// Entirely synthetic prose: no publisher text or network access.
const originalUrl = 'https://example.com/research/synthetic-city';
const title = 'Synthetic researchers measure transport in a model city';
const prose = Array.from({ length: 6 }, (_, i) => `<p>Observation ${i + 1}. The fictional research team measured travel through a model city on a quiet morning. Their invented report compares walking routes with bus journeys and records the assumptions behind each estimate. These sentences are synthetic test material, written to exercise article extraction without reproducing any publication. The final numbers describe a made up experiment and should never be treated as factual research.</p>`).join('');
const page = (body, heading = title, head = '') => `<!doctype html><html><head><title>${heading}</title>${head}</head><body><main><article><h1>${heading}</h1>${body}</article></main></body></html>`;
const options = { originalUrl, sourceUrl: originalUrl, expectedTitle: title };
export const fixtures = [
  { id: 'readable-original', html: page(prose), options, expected: { status: 'readable', identity: true, min_words: 100 } },
  { id: 'readable-archive', html: page(prose), options: { ...options, sourceUrl: `https://web.archive.org/web/20240102123456/${originalUrl}` }, expected: { status: 'readable', identity: true, captured_at: '2024-01-02T12:34:56.000Z' } },
  { id: 'missing-http404', html: page('<p>No page exists here.</p>', 'Page not found'), options: { ...options, httpStatus: 404 }, expected: { status: 'unavailable', identity: false, max_words: 0 } },
  { id: 'missing-archive', html: page('<p>The Wayback Machine has not archived that URL.</p>', 'Wayback Machine'), options: { ...options, expectedTitle: undefined }, expected: { status: 'unavailable', identity: false, max_words: 0 } },
  { id: 'partial-short', html: page('<p>A short synthetic preview describes a fictional transport study but supplies no findings.</p>'), options, expected: { status: 'partial', min_words: 1, max_words: 99 } },
  { id: 'partial-subscription', html: page(`${prose}<aside class="paywall">Subscribe to read the full article</aside>`), options, expected: { status: 'partial', min_words: 100 } },
  { id: 'blocked-challenge', html: page('<form id="challenge-form">Verify you are human</form>', 'Security Verification'), options, expected: { status: 'blocked', identity: false, max_words: 0 } },
  { id: 'blocked-http429', html: page(prose), options: { ...options, httpStatus: 429 }, expected: { status: 'blocked', identity: false, max_words: 0 } },
  { id: 'mismatched-title', html: page(prose, 'Unrelated astronomers discover distant planets beyond our galaxy'), options, expected: { status: 'mismatch', identity: false, max_words: 0 } },
  { id: 'mismatched-archive-target', html: page(prose), options: { ...options, sourceUrl: 'https://web.archive.org/web/20240102123456/https://example.com/another-article' }, expected: { status: 'mismatch', identity: false, max_words: 0 } },
  { id: 'unconfirmed-copy', html: page(prose), options: { originalUrl, sourceUrl: 'https://example.org/syndicated-copy' }, expected: { status: 'needs_review', identity: false, min_words: 100 } },
  { id: 'hidden-body', html: page(`<div hidden>${prose}</div><p>Only this short preview is publicly visible.</p>`), options, expected: { status: 'partial', max_words: 99 } }
];
export function checkFixture(result, expected) {
  const errors = [];
  if (result.status !== expected.status) errors.push(`status: expected ${expected.status}, got ${result.status}`);
  if (expected.identity !== undefined && result.identity.verified !== expected.identity) errors.push('identity mismatch');
  if (expected.min_words !== undefined && result.word_count < expected.min_words) errors.push('too few words');
  if (expected.max_words !== undefined && result.word_count > expected.max_words) errors.push('too many words');
  if (expected.captured_at !== undefined && result.captured_at !== expected.captured_at) errors.push('capture date mismatch');
  if (result.completeness !== 'unknown') errors.push('completeness must remain unknown');
  return errors;
}
