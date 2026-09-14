# Reproducible article retrieval benchmark

This suite measures retrieval candidates and failure classifications. **It does not measure verified complete-article coverage.** A `readable` result means the reader found at least 100 words and some article-identity evidence; it can still include missing paragraphs or unrelated page material. Live completeness ground truth is unknown. Synthetic classification correctness is reported separately.

## Run

Install the reader's pinned dependencies first. In the standalone repository run `npm ci`; in the original development repository run `npm ci --prefix skills/byewall`. Node 20 or newer is required.

```sh
# Offline synthetic classification and harness checks (no network)
node --test benchmarks/runner.test.mjs
node benchmarks/run.mjs

# Fixed 25-article live run; allow several minutes
node benchmarks/run.mjs --live

# Optional explicit reader module for a different checkout
node benchmarks/run.mjs --live --reader /absolute/path/scripts/article.mjs

# A smoke test is marked as a partial corpus run, never the full benchmark
node benchmarks/run.mjs --live --limit 5 --concurrency 1
```

Reports default to timestamped JSON under `benchmarks/results/`; `--output PATH.json` selects a new file. Existing reports are never overwritten. Reports contain metadata, counts, provenance, timing, and classifications only. They contain no article prose, HTML, authentication state, or response headers. If retaining raw material for manual verification, keep it under the ignored `benchmarks/local/` directory and never publish it.

## Corpus and selection

`corpus.v1.json` contains exactly 25 actual article URLs: five each from Bloomberg, Financial Times, The Guardian, AP, and NASA. It is a **convenience sample**, selected before running this benchmark. It mixes known regression cases, older technology/science news, recent FT technology news, an obituary, a short image article, and a long agency roundup. Accessible controls are included to expose extraction limitations that are independent of subscription barriers. Controls have no asserted live expected status because websites and network access change.

Two URLs were used in earlier development smoke tests: the first Bloomberg and first FT items. They are explicitly labeled `previous_smoke_regression`, so they must not be described as blind new samples. All other URLs were chosen through official publisher search results or links, without testing archive availability. FT links were selected from the official [technology index](https://www.ft.com/technology) and their original subscription-page titles. Guardian links came from the official [January 11](https://www.theguardian.com/science/2024/jan/11/all) and [March 2](https://www.theguardian.com/science/2024/mar/02/all) science indexes. Each entry includes its discovery URL. The two regression cases have no expected-title hint; the remaining cases use the observed title.

The corpus is fixed in publisher round-robin order. Its selection timestamp and SHA-256 digest are recorded in every report. `create-corpus.mjs` preserves the original selection recipe and refuses to overwrite the corpus. To expand coverage, introduce a new version with its own date, rationale, and report; do not drop failures or edit an old corpus after seeing results. A fixed corpus makes inputs reproducible, not live server responses. No random sampling or publisher-wide success-rate claim is justified.

## Request policy

The default is two article workers, with at most one in-flight fetch per provider family and at least two seconds between those fetches. Archive.today mirrors and Wayback share a conservative archive request queue. Each URL is tried once; redirects follow the reader's bounded transport policy. Requests have the reader's timeout and byte limits. No retries, login, cookies, browser automation, archive capture, CAPTCHA solving, or access-control bypass occur.

An HTTP 429 or explicit verification screen stops further network requests to that provider family for the rest of the run. Skipped lookups appear separately in `network_events` as `skipped_provider_cooldown`; the reader sees a retrieval failure for that attempt. This means a single early challenge can affect many later results. Report the skip count alongside candidate rate. Different provider paths may still be tried; the challenged provider is never retried. Browser fallback is intentionally outside this automatic measurement.

## Metrics and interpretation

- **Extraction candidate rate:** articles whose final status is `readable`, divided by every selected article, including failures and circuit-breaker skips. It is not a full-text success rate.
- **Status distribution:** `readable`, `partial`, `needs_review`, `mismatch`, `blocked`, and `unavailable`. Raw text counts are retained even for partial extraction. Count size does not establish correctness.
- **Route and provenance:** original publisher, archive.today, Wayback, other public site, or no source; source URL, per-attempt outcome, identity evidence, publication/capture/retrieval dates. Missing dates remain null.
- **Timing:** per-article wall time, median, and p95 (nearest rank), including queue waits and fallback attempts. These are end-to-end CLI times, not server response latency. `network_events` provide individual fetch timing and distinguish requests skipped before transport. Even-sized medians use the lower middle observed value.
- **Browser follow-up candidates:** final outcomes other than `readable` or `mismatch`. This is a triage proxy only. It does not prove a browser is required, would help, or succeeded. `browser_success_measured` is false.
- **Synthetic classification:** 12 authored HTML fixtures cover readable original/archive, HTTP 404, absent archive, short preview, subscription excerpt, challenge, 429, title/target mismatch, unidentified copy, and hidden article text. All prose is invented. Reports show expected/actual statuses and identity/word-count/date constraints. These cases test intended behavior, not real-world error rates.

Reports include Node/platform details and SHA-256 fingerprints of reader scripts, package manifest, and lockfile. A changed corpus or reader during a run causes a nonzero exit and makes the comparison unsuitable for release evidence. Non-readable live outcomes do not themselves cause a nonzero exit; failure is a legitimate measurement.

For a verified full-text metric, independently inspect a public source from beginning through end and compare every paragraph with the extraction. Record exclusions and uncertainty. This suite deliberately leaves `full_text_verified` null until such evidence exists.
