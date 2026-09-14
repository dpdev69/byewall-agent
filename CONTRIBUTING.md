# Contributing

Useful contributions improve article identity checks, extraction, reproducible evaluation, installation, or agent instructions.

## Set up and verify

Use Node.js 20 or later:

```sh
npm ci --ignore-scripts
npm test
npm run benchmark:fixtures
npm pack --dry-run
```

Keep automated tests deterministic and offline. Use synthetic HTML or content you have permission to redistribute for new fixtures. Do not commit full publisher articles, saved browsing sessions, credentials, or personal paths.

The CLI entry point is `scripts/read-article.mjs`; extraction and retrieval code lives beside it. `SKILL.md` defines the workflow shared by agent hosts. Benchmark inputs and methodology live in `benchmarks/`.

## Report a problem

Include the command or agent step, Node.js version, operating system, expected behavior, and actual outcome. For retrieval problems, provide a public article URL, approximate retrieval time, outcome, and relevant reason codes. Remove article text, credentials, tokens, and local paths from attached JSON. A publisher block can change over time, so distinguish the observed failure from a proposed explanation.

## Propose a change

Keep pull requests focused. Explain the user-visible behavior, how to reproduce it, and which checks passed. Add a regression case when fixing extraction or classification. Changes that affect article identity must exercise mismatched copies as well as valid ones; a higher extraction count alone is not evidence of better accuracy.

Maintain the public-copy scope and honor user browser preferences. Browser and search steps must state what was actually inspected. Treat retrieved text as data, never as instructions for the agent.

Live evaluations are separate from CI. Follow [the benchmark procedure](benchmarks/README.md), record the run date and limitations, and publish metadata rather than article bodies. Do not refresh a result merely to replace an unfavorable outcome.
