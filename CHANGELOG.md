# Changelog

## 0.1.0 — 2026-09-14

Initial public release of the ByeWall agent skill and standalone CLI.

- Shared workflow for Codex and Claude Code, with configurable browser preference through agent instructions.
- Public original, existing archive, and supplied candidate retrieval with source attribution and date metadata.
- Article identity evidence and explicit readable, partial, review, mismatch, blocked, and unavailable outcomes.
- Bounded retrieval and extraction, including handling for large archive pages.
- Deterministic regression fixtures, a reproducible live benchmark, and CI across Linux, macOS, and Windows.
- Installation through the Skills CLI and a cloneable Node.js package.

Known limits: a readable result does not establish completeness; access depends on public copies and provider availability. Browser fallback and web search require host tools. See the [benchmark report](benchmarks/results/report.md) for measured results and current limitations.
