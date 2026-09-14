# ByeWall v0.1 retrieval benchmark

**Exploratory run: source files changed while this process was running. This is not a final-release benchmark.** The results below preserve the observed outcomes, including failures; see the JSON fingerprints and rerun only when the final checkout is stable and providers permit requests.

Run: 2026-09-14T18:19:15.786Z to 2026-09-14T18:20:02.925Z. Node v26.8.2; darwin/arm64.

**10/25 extraction candidates (40.0%). Full-text completeness was not independently verified.** This is a fixed convenience sample, not an estimate of Bloomberg, FT, or overall publisher coverage.

12/12 synthetic classification and constraint cases passed. These results do not establish a live false-positive rate.

All 25 selected URLs remain in the denominator. 36 provider lookups were skipped after a previous rate limit or verification screen; these skips affect later results. Median article wall time 0.91s; p95 30.68s, including provider queue waits.

15/25 results are browser-follow-up candidates (a triage proxy). This benchmark did not operate a browser or measure browser success.

| Publisher | Articles | Readable candidates | Partial | Needs review | Mismatch | Blocked | Unavailable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bloomberg | 5 | 0 | 0 | 0 | 0 | 2 | 3 |
| FT | 5 | 0 | 0 | 0 | 0 | 1 | 4 |
| Guardian | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| AP | 5 | 0 | 0 | 0 | 0 | 1 | 4 |
| NASA | 5 | 5 | 0 | 0 | 0 | 0 | 0 |

## All article outcomes

| Article | Status | Words | Route | Seconds | Capture date |
| --- | --- | ---: | --- | ---: | --- |
| [bloomberg-1](https://www.bloomberg.com/news/articles/2026-09-12/anthropic-ceo-says-it-s-time-to-slow-pace-of-improving-ai-models) | blocked | 0 | original | 30.68 | unknown |
| [ft-1](https://www.ft.com/content/20c07191-8da6-440f-b04b-8ea0ebdd9153) | blocked | 0 | original | 33.66 | unknown |
| [guardian-1](https://www.theguardian.com/science/2024/jan/11/amazon-archaeology-lost-cities-ecuador) | readable | 439 | original | 0.91 | unknown |
| [ap-1](https://apnews.com/article/be88e5a1fc018f2407536f1d6f6d3c10) | blocked | 0 | original | 7.57 | unknown |
| [nasa-1](https://www.nasa.gov/image-article/webb-spots-a-starburst/) | readable | 109 | original | 1.17 | unknown |
| [bloomberg-2](https://www.bloomberg.com/news/articles/2024-08-06/nvidia-nvda-blackwell-ai-chip-rollout-slowed-by-engineering-snags) | blocked | 0 | archive-today | 4.33 | 2024-08-06T03:14:27.000Z |
| [ft-2](https://www.ft.com/content/aa8a1be7-abe0-44b7-bcd3-31fd0a44de08) | unavailable | 0 | none | 0.00 | unknown |
| [guardian-2](https://www.theguardian.com/science/2024/jan/11/newly-discovered-cosmic-megastructure-challenges-theories-of-the-universe) | readable | 594 | original | 0.58 | unknown |
| [ap-2](https://apnews.com/article/4217d67977f95ead880835a71ecce098) | unavailable | 0 | none | 0.00 | unknown |
| [nasa-2](https://www.nasa.gov/news-release/nasa-accelerates-space-exploration-earth-science-for-all-in-2024/) | readable | 5386 | original | 0.95 | unknown |
| [bloomberg-3](https://www.bloomberg.com/news/articles/2024-06-02/jensen-huang-computex-keynote-nvidia-reveals-new-ai-software-and-services) | unavailable | 0 | none | 0.00 | unknown |
| [ft-3](https://www.ft.com/content/4564e6a5-69e9-40a6-bf0f-a888f2f4f002) | unavailable | 0 | none | 0.00 | unknown |
| [guardian-3](https://www.theguardian.com/science/2024/jan/11/penelope-rogers-obituary) | readable | 430 | original | 2.27 | unknown |
| [ap-3](https://apnews.com/article/3bbf16e06e29f09320dcbefcf4ffc40b) | unavailable | 0 | none | 0.00 | unknown |
| [nasa-3](https://science.nasa.gov/missions/webb/webb-finds-evidence-for-neutron-star-at-heart-of-young-supernova-remnant/) | readable | 1033 | original | 1.06 | unknown |
| [bloomberg-4](https://www.bloomberg.com/news/articles/2024-03-18/nvidia-unveils-successor-to-its-all-conquering-ai-processor) | unavailable | 0 | none | 0.00 | unknown |
| [ft-4](https://www.ft.com/content/cae60732-f929-4735-a627-db8c14e7c7ed) | unavailable | 0 | none | 0.00 | unknown |
| [guardian-4](https://www.theguardian.com/science/2024/mar/02/doing-something-for-the-real-world-how-1000-uk-schoolkids-helped-crack-a-crystals-conundrum) | readable | 1200 | original | 3.06 | unknown |
| [ap-4](https://apnews.com/article/d46b627cebfab90173a059c81bfeac1a) | unavailable | 0 | none | 0.00 | unknown |
| [nasa-4](https://science.nasa.gov/blogs/webb/2024/05/30/nasas-james-webb-space-telescope-finds-most-distant-known-galaxy/) | readable | 1050 | original | 2.19 | unknown |
| [bloomberg-5](https://www.bloomberg.com/news/articles/2024-02-13/nvidia-s-560-billion-rally-has-analysts-racing-to-boost-targets) | unavailable | 0 | none | 0.00 | unknown |
| [ft-5](https://www.ft.com/content/c765f312-e698-4d31-bf71-f64a656ad6f4) | unavailable | 0 | none | 0.00 | unknown |
| [guardian-5](https://www.theguardian.com/science/2024/mar/02/researchers-study-brain-activity-of-surgeons-for-signs-of-cognitive-overload) | readable | 905 | original | 2.32 | unknown |
| [ap-5](https://apnews.com/article/fa72d5e7327edf285f79587e56e5b560) | unavailable | 0 | none | 0.00 | unknown |
| [nasa-5](https://science.nasa.gov/missions/webb/in-odd-galaxy-nasas-webb-finds-potential-missing-link-to-first-stars/) | readable | 944 | original | 2.89 | unknown |

## Reproduction and limitations

Corpus v1, selected 2026-09-14T18:16:59.818Z, SHA-256 `589c85f05086c1e09ddb5be6c2155859c0dfe2e9add59e121231d1bb9012898e`. Full corpus run: true. Reader unchanged during run: false. Corpus unchanged during run: true.

The corpus includes two labeled prior smoke-test regression cases and 23 newly selected URLs. Recent FT links and older technology/science stories are not balanced or random samples. Public copies can appear, disappear, change, or challenge future requests. Matching a title/URL and exceeding a word threshold do not prove all article paragraphs were extracted. Missing capture or publication dates are unknown, not inferred.

Run `node benchmarks/run.mjs --live` from the repository after `npm ci`. See [methodology](../README.md), [machine-readable report](./report.json), and the [fixed corpus](../corpus.v1.json). The JSON includes every attempt, network outcome, source URL, identity evidence, timing, and reader/dependency fingerprint; no article prose is included.
