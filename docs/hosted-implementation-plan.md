# Hosted Aegis implementation plan and phase record

## Phase 1 — audit

Baseline on 2026-09-27: the Node server authenticated users and inserted free-form queued records, while Bob/MCP and Aegis Core operated separately. All five original tests plus typecheck, build, demo, and independent evidence verification passed. The pre-change commit is preserved by branch `checkpoint-pre-hosted-aegis`.

## Phase 2 — jobs, ingestion, persistence

- Migrated the existing SQLite table without replacing user/runbook data.
- Added durable repository, commit, state, error, Bob execution, Aegis review, receipt, result, and idempotency fields.
- Added strict GitHub acquisition, immutable commit resolution, resource limits, source filtering, and cleanup.
- Added `AEGIS_DB_PATH` and `AEGIS_EVIDENCE_DIR`.

## Phase 3 — Bob adapter

- Added `src/bob-runner.js` around IBM's documented `bob run --format json`.
- Added cost, turn, timeout, read-only tool restrictions, a sanitized child environment, strict response parsing, and a deterministic fake.

## Phase 4 — Core bridge

- Added the orchestrator that calls the existing `prepareReview`, `recordFinding`, and `verifyReview` functions.
- Hardened Core against symlink escapes and allowed hosted repository/commit metadata plus an explicit Bob execution ID.

## Phase 5 — API and authorization

- Added create/list/detail/status/receipt endpoints.
- Added user ownership predicates, idempotent creation, same-origin mutation protection, and a static-file allowlist.

## Phase 6 — frontend

- Replaced the sample submission with repository/reference/scope fields.
- Added persisted review history, status polling, verified findings, hashes, proof, and receipt links.
- Removed automatic production Judge Mode; `?judge=1` remains explicit.

## Phase 7 — hardening and tests

Coverage includes URL/host/ref injection, scope traversal, malformed Bob output, timeout/failure, invalid finding files/lines, stale files, cleanup, ownership, idempotency, persistence, and the existing MCP contract.

## Phase 8 — production

- Added Docker and Render Blueprint configuration with Bob installed server-side.
- Configured one persistent disk for SQLite and evidence.
- Updated product, MCP, proof, security, testing, and limitation documentation.

The genuine Bob/Render end-to-end gate remains deliberately open until a valid server-side key and deployed service are exercised.
