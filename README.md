# ByeWall

**Find readable public copies of research articles, with traceable sources.**

ByeWall is a skill for Codex and Claude Code, with a standalone Node.js CLI. Give it an article URL and it checks the public original and existing archive copies. Your agent can then search for matching public syndication or inspect a page in your preferred browser.

It returns the source actually read, dates when available, article identity evidence, and an explicit outcome. It works without API keys or publisher accounts. Bloomberg and Financial Times are included in the evaluation; availability depends on accessible public copies and can change between runs.

[View the recorded CLI example](demo/README.md) · [Benchmark and limitations](benchmarks/results/report.md)

## Install the skill

Requires **Node.js 20 or later** and an installed Codex or Claude Code host.

Run this in the project where you want to use ByeWall:

```sh
npx skills add dpdev69/byewall-agent --skill byewall -a codex -a claude-code
```

Add `-g` for an installation available across projects. See the [Skills CLI documentation](https://github.com/vercel-labs/skills#install-a-skill) for installation options.

Start a fresh agent session and ask:

> Use the byewall skill to read this article: ARTICLE_URL. Summarize the evidence relevant to my research and cite the copy you actually read. Tell me if access is partial.

In Codex, you can also invoke `$byewall` followed by the URL. On first use, the skill instructs the agent to install its Node dependencies in the installed skill directory:

```sh
npm ci --ignore-scripts --no-audit --no-fund
```

Set `BYEWALL_BROWSER=safari` (or `chrome`, `firefox`, `edge`, `none`, `auto`), or add `.byewall.json` with `{"browser":"safari"}` to your research project. The environment setting takes precedence; the portable default is `auto`. Explicit instructions to your agent take precedence over both. The skill follows your browser preference. Browser fallback requires browser tools in the host; the standalone CLI does not launch or control a browser. If the page needs human verification, the agent stops there and reports it.

## Use the CLI

```sh
git clone https://github.com/dpdev69/byewall-agent.git
cd byewall-agent
npm ci --ignore-scripts
node scripts/read-article.mjs 'https://publisher.example/article'
```

Replace the example URL with the article you want to research. To try a public copy found through search:

```sh
node scripts/read-article.mjs 'https://publisher.example/article' \
  --candidate 'https://public-copy.example/article' \
  --title 'The observed article headline'
```

Use `--no-archives` to check only the original, or the supplied candidate. Run `node scripts/read-article.mjs --help` for available options. The package provides a `byewall` executable when installed through npm from a local checkout or GitHub; it is not published to the npm registry.

Output is JSON. This illustrative metadata excerpt omits the extracted `text` and request `attempts`:

```json
{
  "status": "readable",
  "original_url": "https://publisher.example/article",
  "source_url": "https://public-copy.example/article",
  "title": "The observed article headline",
  "published_at": null,
  "captured_at": null,
  "completeness": "unknown",
  "identity": {
    "verified": true,
    "evidence": ["expected_title_matches"]
  }
}
```

| Outcome | Meaning |
| --- | --- |
| `readable` | Text was extracted; review its identity and completeness. |
| `partial` | An excerpt or possible truncation. |
| `needs_review` | Identity or extraction evidence is insufficient. |
| `mismatch` | The copy appears to be a different story. |
| `blocked` | A paywall, verification screen, or access denial. |
| `unavailable` | The attempted routes produced no usable result. |

`identity.verified` means metadata, URL, or title evidence matched. It is not independent proof. `readable` does not mean the complete article was retrieved. Use the original URL and the actual copy URL in citations, and keep publication and archive capture dates separate.

## What has been tested

**Release evidence:** 39 reader/configuration tests and 4 benchmark harness tests pass locally. The 25-URL live trial found 10 readable candidates, all from Guardian/NASA; archive rate limiting affected the remaining routes. That trial is exploratory because a final parser fix landed during execution. The final-code synthetic suite passes 12/12. Fresh Codex execution passed during development; Claude Code runtime verification remains blocked by local authentication.

See the [benchmark methodology](benchmarks/README.md), [dated report](benchmarks/results/report.md), and [machine-readable results](benchmarks/results/report.json). These describe a fixed sample and its observed outcomes, not a publisher-wide access guarantee. Live checks and deterministic extraction fixtures measure different things; the report keeps them separate.

To run the local checks:

```sh
npm test
npm run benchmark:fixtures
npm pack --dry-run
```

GitHub Actions runs these checks on Linux, macOS, and Windows with Node.js 20, 22, and 24. CI does not fetch live publisher or archive pages. The benchmark documentation explains how to run a separate live evaluation.

## Scope and limits

- Uses public originals, existing archives, and public copies. No subscriptions, account credentials, challenge bypass, or new archive submissions.
- Public archive lookups send the cleaned article URL to archive providers. Do not submit private or token-bearing links.
- The CLI handles retrieval and extraction. Web search and browser inspection are agent steps and depend on available host tools.
- Archive availability, blocks, dates, and page layouts change. A failed lookup does not prove that no copy exists.
- Cite and summarize retrieved evidence. The software license does not grant rights to republish source articles.

See [SKILL.md](SKILL.md) for the complete agent workflow, [CONTRIBUTING.md](CONTRIBUTING.md) for development, and [CHANGELOG.md](CHANGELOG.md) for release notes. Code is [MIT licensed](LICENSE).
